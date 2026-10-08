import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createPublicClient, createWalletClient, formatEther, http, isAddress, getAddress, parseAbi, parseEther, BaseError, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { network, deployerKey, port, custodyToken } from './config.ts'
import { verifyCert } from './psa.ts'

const vaultAbi = parseAbi([
  'function attest(uint256 certId, uint256 specId, uint8 grade, address holder, string name, string symbol)',
  'function confirmCustody(uint256 certId)',
  'function certs(uint256) view returns (bytes32 sku, address holder, uint8 status)',
  'function skuOf(uint256 specId, uint8 grade) pure returns (bytes32)',
  'function skuInfo(bytes32 sku) view returns (address token, address market, uint256 vaulted)',
])

const account = privateKeyToAccount(deployerKey)
const transport = http(process.env.RPC_URL || network.chain.rpcUrls.default.http[0])
const pub = createPublicClient({ chain: network.chain, transport })
const wallet = createWalletClient({ account, chain: network.chain, transport })

// ~0.2 MON covers a first listing (approve, deposit, order) plus a few trades at testnet gas prices.
const DRIP = parseEther(process.env.DRIP_MON ?? '0.2')
const dripFile = new URL('../drips.json', import.meta.url)
// A wallet can top up again once it runs low, at most once per DRIP_EVERY. "Low" must cover the app's biggest action:
// a first buy is three transactions (approve, deposit, order) at about 0.02 MON each, so anything under 0.1 MON tops up.
const LOW = DRIP / 2n
const DRIP_EVERY = 10 * 60 * 1000
// Fresh addresses are free to make, so cap total drips per hour and keep enough MON for attest gas (a new market ~0.23).
const DRIPS_PER_HOUR = Number(process.env.DRIPS_PER_HOUR ?? 30)
const RESERVE = parseEther(process.env.DRIP_RESERVE_MON ?? '0.3')
// NOTE: drip ledger is a local JSON file (one process, one box). Limit: lost on redeploy; fine for a testnet faucet.
const dripped: Record<string, number> = load()
function load(): Record<string, number> {
  try {
    const j = JSON.parse(readFileSync(dripFile, 'utf8'))
    return Array.isArray(j) ? Object.fromEntries(j.map((a: string) => [a, 0])) : j // older ledgers were a plain address list
  } catch {
    return {}
  }
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// ---- input validation (this is a trust boundary: anyone can POST here) ----
function uint(v: unknown, field: string, max: bigint): bigint {
  const s = typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : v
  if (typeof s !== 'string' || !/^\d{1,78}$/.test(s)) throw new HttpError(400, `${field}: expected a non-negative integer`)
  const n = BigInt(s)
  if (n > max) throw new HttpError(400, `${field}: out of range`)
  return n
}
const U256 = 2n ** 256n - 1n
function addr(v: unknown, field: string): Address {
  if (typeof v !== 'string' || !isAddress(v, { strict: false })) throw new HttpError(400, `${field}: expected a 0x address`)
  return getAddress(v)
}
function str(v: unknown, field: string, max: number, re: RegExp): string {
  if (typeof v !== 'string' || v.length < 1 || v.length > max || !re.test(v)) throw new HttpError(400, `${field}: 1-${max} chars matching ${re}`)
  return v
}

async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 4096) throw new HttpError(413, 'body too large')
  }
  try {
    const j = JSON.parse(raw)
    if (j && typeof j === 'object' && !Array.isArray(j)) return j
  } catch {}
  throw new HttpError(400, 'expected a JSON object')
}

// One signer key: serialize its txs so concurrent requests can't race on the same nonce.
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const p = queue.then(fn)
  queue = p.catch(() => {})
  return p
}

/** Simulate first so reverts come back as readable reasons, then send and wait (Monad confirms in ~1s). */
const send = (functionName: 'attest' | 'confirmCustody', args: readonly unknown[]) => serial(() => sendNow(functionName, args))
async function sendNow(functionName: 'attest' | 'confirmCustody', args: readonly unknown[]) {
  const { request } = await pub.simulateContract({ account, address: network.vault, abi: vaultAbi, functionName, args } as never)
  const hash = await wallet.writeContract(request)
  const receipt = await pub.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new HttpError(502, `tx ${hash} reverted`)
  return hash
}

const routes: Record<string, (b: Record<string, unknown>, req: IncomingMessage) => Promise<object>> = {
  async '/attest'(b) {
    const certId = uint(b.certId, 'certId', U256)
    const specId = uint(b.specId, 'specId', U256)
    const grade = Number(uint(b.grade, 'grade', 10n))
    if (grade < 1) throw new HttpError(400, 'grade: 1-10')
    const holder = addr(b.holder, 'holder')
    const name = str(b.name, 'name', 64, /^[\p{L}\p{N} .,'#&()\-\/]+$/u)
    const symbol = str(b.symbol, 'symbol', 16, /^[A-Za-z0-9\-]+$/)

    const v = await verifyCert(certId)
    if (!v) throw new HttpError(422, `cert ${certId} not found in grader registry`)
    if (v.specId !== specId || v.grade !== grade)
      throw new HttpError(422, `cert ${certId} is spec ${v.specId} grade ${v.grade}, not spec ${specId} grade ${grade}`)

    const txHash = await send('attest', [certId, specId, grade, holder, name, symbol])
    const sku = await pub.readContract({ address: network.vault, abi: vaultAbi, functionName: 'skuOf', args: [specId, grade] })
    const [token, market] = await pub.readContract({ address: network.vault, abi: vaultAbi, functionName: 'skuInfo', args: [sku] })
    return { txHash, sku, token, market, verifiedBy: v.source }
  },

  // Production: the custodian calls this after physically receiving and inspecting the slab.
  // NOTE: hackathon demo exposes it as an open button signed by the team's custodian key. Limit: anyone can
  // mark any attested cert as vaulted; must be gated (custodian login) before real cards are involved.
  // Mainnet (config requires CUSTODY_TOKEN there): only the custodian, holding the token, may confirm.
  async '/custody'(b, req) {
    if (custodyToken) {
      const got = Buffer.from(String(req.headers['x-custody-token'] ?? ''))
      const want = Buffer.from(custodyToken)
      if (got.length !== want.length || !timingSafeEqual(got, want)) throw new HttpError(403, 'custodian only')
    }
    const certId = uint(b.certId, 'certId', U256)
    return { txHash: await send('confirmCustody', [certId]) }
  },

  async '/drip'(b) {
    if (!network.drip) throw new HttpError(403, 'drip is testnet only')
    const to = addr(b.address, 'address')
    const last = dripped[to]
    if (last !== undefined && Date.now() - last < DRIP_EVERY) throw new HttpError(429, 'already topped up this address in the last 10 minutes')
    if (Object.values(dripped).filter((t) => Date.now() - t < 3600_000).length >= DRIPS_PER_HOUR)
      throw new HttpError(429, 'faucet busy, try again later or use faucet.monad.xyz')
    dripped[to] = Date.now() // reserve before awaiting so concurrent requests can't double-drip
    try {
      if ((await pub.getBalance({ address: to })) >= LOW) throw new HttpError(409, 'this address still has enough MON for fees')
      if ((await pub.getBalance({ address: account.address })) < RESERVE + DRIP)
        throw new HttpError(503, 'faucet is low, use faucet.monad.xyz for MON')
      const hash = await serial(async () => {
        const h = await wallet.sendTransaction({ to, value: DRIP })
        await pub.waitForTransactionReceipt({ hash: h }) // next tx from this key must see the new nonce
        return h
      })
      writeFileSync(dripFile, JSON.stringify(dripped))
      return { txHash: hash, amount: formatEther(DRIP) }
    } catch (e) {
      if (last === undefined) delete dripped[to]
      else dripped[to] = last
      throw e
    }
  },
}

function reply(res: ServerResponse, status: number, data: object) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type, x-custody-token',
  })
  res.end(JSON.stringify(data))
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return reply(res, 204, {})
  // Read-only registry lookup so the app can pre-fill card + grade from a cert number. Attestation re-verifies.
  const cert = req.method === 'GET' && /^\/cert\/(\d{1,20})$/.exec(req.url ?? '')
  if (cert) {
    const v = await verifyCert(BigInt(cert[1])).catch(() => undefined)
    if (v === undefined) return reply(res, 502, { error: 'grader registry unavailable' })
    return v ? reply(res, 200, { specId: v.specId.toString(), grade: v.grade, subject: v.subject }) : reply(res, 404, { error: 'cert not found' })
  }
  if (req.method === 'GET' && req.url === '/health')
    return reply(res, 200, { network: network.name, chainId: network.chain.id, vault: network.vault, attestor: account.address })
  const route = req.method === 'POST' && routes[req.url ?? '']
  if (!route) return reply(res, 404, { error: 'not found' })
  try {
    reply(res, 200, await route(await body(req), req))
  } catch (e) {
    if (e instanceof HttpError) return reply(res, e.status, { error: e.message })
    const msg = e instanceof BaseError ? e.shortMessage : 'internal error'
    console.error(req.url, e instanceof BaseError ? e.shortMessage : e)
    reply(res, 502, { error: msg })
  }
}).listen(port, () => console.log(`attestor on :${port} (${network.name}, vault ${network.vault}, signer ${account.address})`))
