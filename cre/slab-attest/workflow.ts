import {
  bytesToHex,
  consensusIdenticalAggregation,
  decodeJson,
  EVMClient,
  encodeCallMsg,
  getNetwork,
  HTTPCapability,
  HTTPClient,
  type HTTPPayload,
  type HTTPSendRequester,
  handler,
  json,
  LAST_FINALIZED_BLOCK_NUMBER,
  prepareReportRequest,
  type Runtime,
  TxStatus,
} from '@chainlink/cre-sdk'
import { type Address, decodeFunctionResult, encodeAbiParameters, encodeFunctionData, parseAbi, zeroAddress } from 'viem'
import { z } from 'zod'
import fixtures from '../fixtures/psa-certs.json'

export const configSchema = z.object({
  chainSelectorName: z.string(),
  vault: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  receiver: z.string(), // "" = no receiver deployed yet: build + sign the report, skip the onchain write
  usePsaApi: z.boolean(),
  psaUrl: z.string().url(),
  // false for the demo registry API on testnet, which needs no token; true for PSA's own API (secret PSA_TOKEN)
  psaAuth: z.boolean(),
  gasLimit: z.string(),
})
export type Config = z.infer<typeof configSchema>

// Trust boundary: anyone allowed to hit the HTTP trigger controls this payload. specId/grade are NOT taken from it,
// they come from the grader registry below.
const payloadSchema = z.object({
  certId: z.string().regex(/^\d{1,20}$/),
  holder: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  name: z.string().min(1).max(64),
  symbol: z.string().regex(/^[A-Za-z0-9-]{1,16}$/),
})

/** What every node must agree on before anything is written. Strings so identical-aggregation compares exactly. */
export type Verified = { certId: string; specId: string; grade: string }

type PsaCert = { CertNumber: string; SpecID: number; CardGrade: string }

export function parseCert(certId: string, cert: PsaCert | undefined): Verified {
  if (!cert || String(cert.CertNumber) !== certId) throw new Error(`cert ${certId} not in grader registry`)
  // "GEM MT 10" -> 10. NOTE: half grades ("8.5") rejected, the vault's grade is a uint8.
  const m = /(?:^|\s)(\d{1,2})$/.exec(cert.CardGrade.trim())
  const grade = m ? Number(m[1]) : Number.NaN
  if (!(grade >= 1 && grade <= 10)) throw new Error(`cert ${certId}: unsupported grade "${cert.CardGrade}"`)
  if (!Number.isSafeInteger(cert.SpecID) || cert.SpecID <= 0) throw new Error(`cert ${certId}: bad SpecID`)
  return { certId, specId: String(cert.SpecID), grade: String(grade) }
}

// Runs on every DON node independently; results are then aggregated.
const fetchPsa = (sender: HTTPSendRequester, url: string, token: string, certId: string): Verified => {
  const res = sender.sendRequest({ url: url + certId, method: 'GET', headers: token ? { authorization: `bearer ${token}` } : {} }).result()
  if (res.statusCode !== 200) throw new Error(`grader registry returned ${res.statusCode}`)
  return parseCert(certId, (json(res) as { PSACert?: PsaCert }).PSACert)
}

const vaultAbi = parseAbi(['function certs(uint256) view returns (bytes32 sku, address holder, uint8 status)'])

export const onAttestRequest = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const cfg = runtime.config
  const req = payloadSchema.parse(decodeJson(payload.input))

  // 1. Verify against the grader registry, with consensus across nodes.
  let v: Verified
  if (cfg.usePsaApi) {
    const token = cfg.psaAuth ? runtime.getSecret({ id: 'PSA_TOKEN' }).result().value : ''
    v = new HTTPClient()
      .sendRequest(runtime, fetchPsa, consensusIdenticalAggregation<Verified>())(cfg.psaUrl, token, req.certId)
      .result()
  } else {
    // NOTE: no PSA bearer token for the demo, so the registry is a bundled fixtures file (deterministic, so every
    // node trivially agrees). Limit: only demo certs verify; flip usePsaApi + set PSA_TOKEN for the live registry.
    v = parseCert(req.certId, (fixtures as unknown as Record<string, { PSACert: PsaCert }>)[req.certId]?.PSACert)
  }
  runtime.log(`verified cert ${v.certId}: spec ${v.specId} grade ${v.grade} (${cfg.usePsaApi ? `registry API ${cfg.psaUrl}` : 'fixtures'})`)

  // 2. Read the vault on Monad: refuse certs it already knows (it would revert anyway).
  const network = getNetwork({ chainFamily: 'evm', chainSelectorName: cfg.chainSelectorName })
  if (!network) throw new Error(`unknown chain ${cfg.chainSelectorName}`)
  const evm = new EVMClient(network.chainSelector.selector)
  const read = evm
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: cfg.vault as Address,
        data: encodeFunctionData({ abi: vaultAbi, functionName: 'certs', args: [BigInt(v.certId)] }),
      }),
      blockNumber: LAST_FINALIZED_BLOCK_NUMBER,
    })
    .result()
  const [, , status] = decodeFunctionResult({ abi: vaultAbi, functionName: 'certs', data: bytesToHex(read.data) })
  if (status !== 0) throw new Error(`cert ${v.certId} already known to SlabVault (status ${status})`)

  // 3. DON-signed report carrying exactly SlabVault.attest's arguments.
  const reportData = encodeAbiParameters(
    [
      { type: 'uint256', name: 'certId' },
      { type: 'uint256', name: 'specId' },
      { type: 'uint8', name: 'grade' },
      { type: 'address', name: 'holder' },
      { type: 'string', name: 'name' },
      { type: 'string', name: 'symbol' },
    ],
    [BigInt(v.certId), BigInt(v.specId), Number(v.grade), req.holder as Address, req.name, req.symbol],
  )
  const report = runtime.report(prepareReportRequest(reportData)).result()
  runtime.log(`report payload ${reportData}`)

  // 4. Deliver via the Keystone forwarder to GradeOracle on Monad, the onchain record the attestor relay lists from.
  if (!cfg.receiver) {
    runtime.log('no receiver configured: report built and signed, onchain write skipped')
    return JSON.stringify({ ...v, holder: req.holder, reportData, written: false })
  }
  const res = evm.writeReport(runtime, { receiver: cfg.receiver, report, gasConfig: { gasLimit: cfg.gasLimit } }).result()
  if (res.txStatus !== TxStatus.SUCCESS) throw new Error(`writeReport failed: ${res.errorMessage ?? res.txStatus}`)
  const txHash = bytesToHex(res.txHash ?? new Uint8Array(32))
  runtime.log(`attest report written: ${txHash}`)
  return JSON.stringify({ ...v, holder: req.holder, reportData, written: true, txHash })
}

export const initWorkflow = () => [
  // NOTE: trigger({}) accepts any caller, fine for simulate. Limit: a deployed workflow must list authorizedKeys.
  handler(new HTTPCapability().trigger({}), onAttestRequest),
]
