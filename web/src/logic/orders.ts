// Order maths: one pure function for each derived number, so every screen reconciles to the same value.
// Prices are bigint cents (the market tick unit), sizes are whole cards, totals are base units (see money.ts).
import { centsToUnits, divRound } from './money.ts'

export type Level = { price: bigint; size: bigint }

/** What a market buy or sell would do against the book as it stands. */
export type Walk = {
  /** Cards that would fill. May be less than asked when the book is thin. */
  qty: bigint
  /** Cards that would not fill. */
  short: bigint
  /** Exact total in base units: sum of price x size over the levels touched. */
  units: bigint
  /** Average price per card in cents, rounded half up. Display only: `units` is the exact figure. */
  avgCents: bigint
  /** Worst price touched: the highest ask for a buy, the lowest bid for a sell. This is the price protection to review. */
  limitCents: bigint
  levels: number
}

function walk(sorted: Level[], want: bigint): Walk {
  let qty = 0n
  let units = 0n
  let limit = 0n
  let levels = 0
  for (const l of sorted) {
    if (qty >= want) break
    if (l.size <= 0n) continue
    const take = l.size < want - qty ? l.size : want - qty
    qty += take
    units += centsToUnits(l.price) * take
    limit = l.price
    levels++
  }
  const avgCents = qty === 0n ? 0n : divRound(units, centsToUnits(1n) * qty, 'halfUp')
  return { qty, short: want - qty, units, avgCents, limitCents: limit, levels }
}

/** Buying `want` cards: asks, lowest first. */
export const walkAsks = (asks: Level[], want: bigint): Walk => walk([...asks].sort((a, b) => (a.price < b.price ? -1 : a.price > b.price ? 1 : 0)), want)
/** Selling `want` cards: bids, highest first. */
export const walkBids = (bids: Level[], want: bigint): Walk => walk([...bids].sort((a, b) => (a.price > b.price ? -1 : a.price < b.price ? 1 : 0)), want)

/** Fee on an amount, in base units. Rounded up, so the venue is never under-collected and a fee is never shown lower than charged. */
export const feeUnits = (amount: bigint, bps: bigint): bigint => divRound(amount * bps, 10_000n, 'ceil')
/** What a buyer pays in total. */
export const buyTotal = (units: bigint, takerBps: bigint): bigint => units + feeUnits(units, takerBps)
/** What a seller receives. */
export const sellProceeds = (units: bigint, takerBps: bigint): bigint => units - feeUnits(units, takerBps)

/** The gap between best offer and ask. `bps` is the gap as a share of the ask, rounded half up. */
export function spread(askCents?: bigint, bidCents?: bigint): { cents: bigint; bps: bigint } | undefined {
  if (askCents === undefined || bidCents === undefined || askCents <= 0n) return undefined
  const cents = askCents - bidCents
  return { cents, bps: divRound(cents * 10_000n, askCents, 'halfUp') }
}

/** Unrealised profit or loss: quantity x (mark - average cost), in base units. The mark is stated by the caller ("valued at best offer"). */
export const unrealisedPnl = (qty: bigint, avgCostUnitsPerCard: bigint, markUnitsPerCard: bigint): bigint => qty * (markUnitsPerCard - avgCostUnitsPerCard)

export type Fill = { price: bigint; size: bigint; mine: 'buy' | 'sell' | undefined }
/** Average price per card of the user's purchases on one market, in base units per card (rounded half up). Sales are not netted off:
 *  the basis is "what you paid on average for the cards you bought here". */
export function averageBuyUnits(fills: Fill[]): { qty: bigint; avgUnits: bigint } | undefined {
  let qty = 0n
  let units = 0n
  for (const f of fills) if (f.mine === 'buy') (qty += f.size), (units += centsToUnits(f.price) * f.size)
  return qty === 0n ? undefined : { qty, avgUnits: divRound(units, qty, 'halfUp') }
}

/** Total value of holdings at a stated mark, plus cash, in base units. Cards with no mark are left out and counted. */
export function portfolioValue(holdings: { qty: bigint; markCents?: bigint }[], cashUnits: bigint) {
  let cards = 0n
  let unmarked = 0
  for (const h of holdings) {
    if (h.markCents === undefined) unmarked++
    else cards += centsToUnits(h.markCents) * h.qty
  }
  return { cards, cash: cashUnits, total: cards + cashUnits, unmarked }
}

/** Order book levels for display: sorted, aggregated by price, with cumulative size and a depth share for the bars. */
export function aggregate(levels: Level[], side: 'ask' | 'bid') {
  const by = new Map<bigint, bigint>()
  for (const l of levels) by.set(l.price, (by.get(l.price) ?? 0n) + l.size)
  const rows = [...by].map(([price, size]) => ({ price, size })).sort((a, b) => (a.price === b.price ? 0 : (a.price < b.price) === (side === 'ask') ? -1 : 1))
  let cum = 0n
  const out = rows.map((r) => ({ ...r, cumulative: (cum += r.size) }))
  const total = cum
  return out.map((r) => ({ ...r, depthBps: total === 0n ? 0n : divRound(r.cumulative * 10_000n, total, 'halfUp') }))
}

// ---------------------------------------------------------------- validation

/** The market's own rules, read from the order book contract (see marketRules in chain.ts), never assumed. */
export type Rules = { tickCents: bigint; minSize: bigint; maxSize: bigint; takerBps: bigint; makerBps: bigint }

export type Problem = { code: 'tick' | 'min' | 'max' | 'cash' | 'tokens' | 'gas' | 'stale' | 'price'; message: string }

export type OrderCheck = {
  side: 'buy' | 'sell'
  kind: 'limit' | 'market'
  priceCents: bigint
  size: bigint
  rules: Rules
  /** Cash free to spend, base units. */
  cashUnits: bigint
  /** Cards free to sell. */
  cards: bigint
  /** Network fee balance and a fresh estimate for this flow, in wei. Omit estimate when fees are covered. */
  gasWei?: bigint
  gasNeededWei?: bigint
  /** The price the user reviewed, and the price now. A market order that moved is stale. */
  reviewedCents?: bigint
  currentCents?: bigint
}

/** Everything that would stop an order, in plain language, before the review step. Empty means it can proceed. */
export function validateOrder(c: OrderCheck): Problem[] {
  const p: Problem[] = []
  if (c.priceCents <= 0n) p.push({ code: 'price', message: 'Enter a price above zero.' })
  else if (c.priceCents % c.rules.tickCents !== 0n) p.push({ code: 'tick', message: `Prices move in steps of ${c.rules.tickCents} cent${c.rules.tickCents === 1n ? '' : 's'}.` })
  if (c.size < c.rules.minSize) p.push({ code: 'min', message: `The smallest order is ${c.rules.minSize} card${c.rules.minSize === 1n ? '' : 's'}.` })
  if (c.size > c.rules.maxSize) p.push({ code: 'max', message: `The largest order is ${c.rules.maxSize} cards.` })
  if (c.side === 'buy') {
    const need = buyTotal(centsToUnits(c.priceCents) * c.size, c.rules.takerBps)
    if (c.cashUnits < need) p.push({ code: 'cash', message: 'Not enough cash for this order.' })
  } else if (c.cards < c.size) p.push({ code: 'tokens', message: 'You do not hold enough of this card.' })
  if (c.gasNeededWei !== undefined && (c.gasWei ?? 0n) < c.gasNeededWei) p.push({ code: 'gas', message: 'Not enough MON to pay the network fee.' })
  if (c.kind === 'market' && c.reviewedCents !== undefined && c.currentCents !== undefined && c.reviewedCents !== c.currentCents) p.push({ code: 'stale', message: 'The price moved since you reviewed it.' })
  return p
}
