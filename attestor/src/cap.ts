import type { IncomingMessage } from 'node:http'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// Every sponsored write is free to the caller and costs the attestor's signer gas, so cap each one per hour.
// NOTE: in-memory and per-process, so a redeploy forgets it. Fine for one testnet relay box; move to the
// drip ledger file or Redis if the attestor is ever run on more than one instance.
const hits: Record<string, number[]> = {}

/** Throws 429 unless every limit has room. Checks them all before recording, so a refusal costs no quota. */
export function cap(msg: string, ...limits: [key: string, perHour: number][]) {
  const now = Date.now()
  for (const k in hits) {
    hits[k] = hits[k].filter((t) => now - t < 3600_000)
    if (!hits[k].length) delete hits[k]
  }
  const lists = limits.map(([k, n]) => {
    const h = (hits[k] ??= [])
    if (h.length >= n) throw new HttpError(429, msg)
    return h
  })
  for (const h of lists) h.push(now)
}

/** Test seam: forget every recorded hit. */
export const resetCap = () => {
  for (const k in hits) delete hits[k]
}

/** The caller's IP for per-visitor caps. Render's edge sets cf-connecting-ip; the last X-Forwarded-For hop is the fallback.
 * A forged header can only move a caller into another per-IP bucket; the global caps still hold. */
export function clientIp(req: IncomingMessage): string {
  const cf = req.headers['cf-connecting-ip']
  if (typeof cf === 'string' && cf) return cf
  const xff = String(req.headers['x-forwarded-for'] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return xff.at(-1) ?? req.socket.remoteAddress ?? 'unknown'
}
