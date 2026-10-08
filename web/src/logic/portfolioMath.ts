// Portfolio value over time, built from real fills and marks. For each market the quantity held at a time is worked back from today's
// holding by undoing the account's own later fills; the mark is that market's last sale price at that time. Cards that arrived by
// vaulting (not by a fill) are therefore counted from the start. Points start once every held market has a mark, never before.
import { centsToUnits } from './money.ts'

export type MarketFills = {
  /** Cards held now. */
  qtyNow: bigint
  /** Every fill on the market, oldest first. `mine` is the account's side of that fill, if it took part. */
  fills: { t: number; priceCents: bigint; size: bigint; mine?: 'buy' | 'sell' }[]
}
export type Point = { t: number; units: bigint }

export function valueSeries(markets: MarketFills[]): Point[] {
  const held = markets.filter((m) => m.qtyNow > 0n)
  if (!held.length) return []
  const times = [...new Set(held.flatMap((m) => m.fills.map((f) => f.t)))].sort((a, b) => a - b)
  const out: Point[] = []
  for (const t of times) {
    let units = 0n
    let marked = true
    for (const m of held) {
      let mark: bigint | undefined
      let undo = 0n
      for (const f of m.fills) {
        if (f.t <= t) mark = f.priceCents
        else if (f.mine) undo += f.mine === 'buy' ? f.size : -f.size // a later buy is not yet held at t; a later sell still is
      }
      if (mark === undefined) {
        marked = false
        break
      }
      const qty = m.qtyNow - undo
      units += (qty > 0n ? qty : 0n) * centsToUnits(mark)
    }
    if (marked) out.push({ t, units })
  }
  return out
}

/** Change across a period: the last point less the value at the period's start (the last point before it, or the first inside it). */
export function change(points: Point[], since: number): { start: Point; end: Point; units: bigint; bps: bigint | undefined } | undefined {
  const inside = points.filter((p) => p.t >= since)
  if (!inside.length) return undefined
  const before = [...points].reverse().find((p) => p.t < since)
  const start = since > 0 && before ? before : inside[0]
  const end = inside[inside.length - 1]
  if (start === end && inside.length < 2) return undefined
  const units = end.units - start.units
  return { start, end, units, bps: start.units > 0n ? (units * 10_000n) / start.units : undefined }
}
