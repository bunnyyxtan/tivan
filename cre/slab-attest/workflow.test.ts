// Runs the real handler on the CRE SDK's test runtime (capabilities mocked, consensus + report signing real-ish).
// Used because `cre workflow simulate` needs `cre login`; see README.
import { describe, expect } from 'bun:test'
import { EvmMock, HttpActionsMock, newTestRuntime, test } from '@chainlink/cre-sdk/test'
import { getNetwork } from '@chainlink/cre-sdk'
import { decodeAbiParameters, encodeAbiParameters, toHex } from 'viem'
import { type Config, onAttestRequest } from './workflow'
import base from './config.testnet.json'

// The bundled-fixtures path, with no onchain write.
const fx = { ...base, usePsaApi: false, receiver: '' } as Config

const selector = getNetwork({ chainFamily: 'evm', chainSelectorName: 'monad-testnet' })!.chainSelector.selector
const holder = '0x9037A6733A9bD1641357AE5a12338378D3977911'
const payload = (o: object) => ({ input: new TextEncoder().encode(JSON.stringify(o)) }) as never
const req = { certId: '81234569', holder, name: 'PSA 10 Base Set Charizard Holo', symbol: 'CHZ10' }
const certsReply = (status: number) =>
  ({ data: Buffer.from(encodeAbiParameters([{ type: 'bytes32' }, { type: 'address' }, { type: 'uint8' }], [toHex(0, { size: 32 }), holder, status]).slice(2), 'hex') }) as never

describe('slab-attest', () => {
  test('fixtures cert -> report carries attest(certId, specId, grade, holder, name, symbol)', () => {
    const evm = EvmMock.testInstance(selector)
    evm.callContract = () => certsReply(0)
    const out = JSON.parse(onAttestRequest(newTestRuntime(null, {}, fx), payload(req)))
    expect(out.written).toBe(false)
    const [certId, specId, grade, h, name, symbol] = decodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint8' }, { type: 'address' }, { type: 'string' }, { type: 'string' }],
      out.reportData,
    )
    expect([certId, specId, grade, h, name, symbol]).toEqual([81234569n, 4n, 10, holder, req.name, 'CHZ10'])
  })

  test('PSA API path: grade comes from the registry, written through the receiver', () => {
    const http = HttpActionsMock.testInstance()
    let auth = ''
    http.sendRequest = (r) => {
      auth = r.headers.authorization
      return { statusCode: 200, body: new TextEncoder().encode(JSON.stringify({ PSACert: { CertNumber: '81234569', SpecID: 4, CardGrade: 'MINT 9' } })) } as never
    }
    const evm = EvmMock.testInstance(selector)
    evm.callContract = () => certsReply(0)
    evm.writeReport = () => ({ txStatus: 'TX_STATUS_SUCCESS', txHash: Buffer.alloc(32, 1).toString('base64') }) as never
    const cfg = { ...base, usePsaApi: true, psaAuth: true, receiver: '0x000000000000000000000000000000000000dEaD' } as Config
    const secrets = new Map([['main', new Map([['PSA_TOKEN', 'tok']])]])
    const out = JSON.parse(onAttestRequest(newTestRuntime(secrets, {}, cfg), payload(req)))
    expect(auth).toBe('bearer tok')
    expect(out.grade).toBe('9')
    expect(out.written).toBe(true)
  })

  test('testnet config: demo registry API over HTTP with no token, report written to GradeOracle', () => {
    const http = HttpActionsMock.testInstance()
    let url = ''
    let auth: string | undefined = 'unset'
    http.sendRequest = (r) => {
      url = r.url
      auth = r.headers.authorization
      return { statusCode: 200, body: new TextEncoder().encode(JSON.stringify({ PSACert: { CertNumber: '81234569', SpecID: 4, CardGrade: 'GEM MT 10' } })) } as never
    }
    const evm = EvmMock.testInstance(selector)
    evm.callContract = () => certsReply(0)
    let receiver = ''
    // The receiver arrives as raw address bytes.
    evm.writeReport = (r) => ((receiver = `0x${Buffer.from(r.receiver as unknown as Uint8Array).toString('hex')}`), { txStatus: 'TX_STATUS_SUCCESS', txHash: Buffer.alloc(32, 2).toString('base64') }) as never
    const out = JSON.parse(onAttestRequest(newTestRuntime(null, {}, base as Config), payload(req)))
    expect(url).toBe(`${base.psaUrl}81234569`)
    expect(auth).toBeUndefined()
    expect(receiver.toLowerCase()).toBe(base.receiver.toLowerCase())
    expect(out.grade).toBe('10')
    expect(out.written).toBe(true)
  })

  test('rejects unknown certs, already-attested certs and bad payloads', () => {
    const evm = EvmMock.testInstance(selector)
    evm.callContract = () => certsReply(1)
    const rt = () => newTestRuntime(null, {}, fx)
    expect(() => onAttestRequest(rt(), payload({ ...req, certId: '99999999' }))).toThrow('not in grader registry')
    expect(() => onAttestRequest(rt(), payload(req))).toThrow('already known')
    expect(() => onAttestRequest(rt(), payload({ ...req, holder: '0x12' }))).toThrow()
    expect(() => onAttestRequest(rt(), payload({ ...req, symbol: 'bad symbol!' }))).toThrow()
  })
})
