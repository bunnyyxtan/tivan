import { attestorUrl } from './config'

/** POST to the attestor (the server that checks certificates and signs custody). Errors come back as readable text. */
export async function post(path: string, body: object) {
  const res = await fetch(attestorUrl + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok) throw new Error(/cert known/.test(j.error) ? 'This certificate is already in the vault.' : (j.error ?? `HTTP ${res.status}`))
  return j as { txHash?: string; verifiedBy?: string }
}

/** Ask the test faucet for a little MON for network fees (testnet only; the attestor enforces its limits). */
export const drip = (address: string) => post('/drip', { address })
