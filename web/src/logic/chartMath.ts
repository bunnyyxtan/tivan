// Price chart maths: range filtering and OHLC bucketing. Pure functions; the chart only draws what these return.

export type Trade = { t: number; price: bigint; size: bigint; hash?: string }
export type Range = '1D' | '1W' | '1M' | '3M' | '1Y' | 'All'
export const RANGES: Range[] = ['1D', '1W', '1M', '3M', '1Y', 'All']
const DAY = 86_400
const SPAN: Record<Range, number> = { '1D': DAY, '1W': 7 * DAY, '1M': 30 * DAY, '3M': 90 * DAY, '1Y': 365 * DAY, All: 0 }

/** Trades inside a range, ending at `now` (unix seconds). Oldest first, never reordered or altered. */
export function inRange(trades: Trade[], range: Range, now: number): Trade[] {
  const from = SPAN[range] ? now - SPAN[range] : -Infinity
  return trades.filter((x) => x.t >= from && x.t <= now).sort((a, b) => a.t - b.t)
}

/** The offset of a time zone from UTC at an instant, in seconds. */
function offsetSeconds(t: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(t * 1000))
  const g = (k: string) => Number(parts.find((p) => p.type === k)!.value)
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) / 1000 - t
}

/** Midnight in a time zone for the day containing t (unix seconds), so day buckets break where the viewer's days break. */
export function startOfDay(t: number, tz: string): number {
  const local = t + offsetSeconds(t, tz)
  const midnightLocal = local - (((local % DAY) + DAY) % DAY)
  // The offset can differ at midnight (daylight saving), so settle it once.
  const guess = midnightLocal - offsetSeconds(t, tz)
  return midnightLocal - offsetSeconds(guess, tz)
}

/** Bucket width for a range, or undefined when the points should be drawn as they are. */
export function bucketFor(range: Range, count: number): 'hour' | 'day' | undefined {
  // Only aggregate where density warrants it: a few hundred points or fewer are drawn individually.
  if (count <= 300) return undefined
  return range === '1D' || range === '1W' ? 'hour' : 'day'
}

export type Candle = { t: number; open: bigint; high: bigint; low: bigint; close: bigint; volume: bigint; n: number }

/** OHLC candles. Empty buckets are omitted, never filled, so a gap in trading stays a gap. */
export function bucketOHLC(trades: Trade[], width: 'hour' | 'day', tz: string): Candle[] {
  const out: Candle[] = []
  let cur: Candle | undefined
  for (const x of [...trades].sort((a, b) => a.t - b.t)) {
    const start = width === 'day' ? startOfDay(x.t, tz) : x.t - (x.t % 3600)
    if (!cur || cur.t !== start) out.push((cur = { t: start, open: x.price, high: x.price, low: x.price, close: x.price, volume: 0n, n: 0 }))
    if (x.price > cur.high) cur.high = x.price
    if (x.price < cur.low) cur.low = x.price
    cur.close = x.price
    cur.volume += x.size
    cur.n++
  }
  return out
}

/** The one-sentence summary for screen readers: change over the range, high, low, count. Prices as formatted by the caller. */
export function summary(trades: Trade[], fmt: (cents: bigint) => string, label: string): string {
  if (trades.length === 0) return `No trades ${label}.`
  const first = trades[0].price
  const last = trades[trades.length - 1].price
  const hi = trades.reduce((m, x) => (x.price > m ? x.price : m), first)
  const lo = trades.reduce((m, x) => (x.price < m ? x.price : m), first)
  const dir = last > first ? 'rose' : last < first ? 'fell' : 'was unchanged'
  return `${trades.length} trade${trades.length === 1 ? '' : 's'} ${label}. The price ${dir}${last === first ? '' : ` from ${fmt(first)} to ${fmt(last)}`}. High ${fmt(hi)}, low ${fmt(lo)}.`
}
