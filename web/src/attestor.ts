import type { Address } from 'viem'
import { pub } from './chain'
import { attestorUrl, net } from './config'

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

/** Monad charges the gas limit: about 0.02 MON per transaction. A stated estimate, not a promise. */
export const MON_PER_TX = 2n * 10n ** 16n

/**
 * Test network only: before an action, make sure the account can pay its network fees. If it is short, ask the faucet and
 * wait (up to 20 s) until the MON is visible. Returns false when it could not top up; the transaction then says why.
 */
export async function ensureGas(address: Address, steps: number): Promise<boolean> {
  if (net.name !== 'testnet') return true
  const need = MON_PER_TX * BigInt(steps)
  if ((await pub.getBalance({ address })) >= need) return true
  try {
    await drip(address)
  } catch {
    // Topped up in the last 10 minutes, or the faucet is busy: the balance check below decides.
  }
  for (let i = 0; i < 20; i++) {
    if ((await pub.getBalance({ address })) >= need) return true
    await new Promise((r) => setTimeout(r, 1000))
  }
  return false
}
