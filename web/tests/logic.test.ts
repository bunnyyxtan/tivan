// Run with: cd web && npm test   (node's built-in runner, no extra dependency)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { centsToUnits, divRound, formatBps, formatUsd, parseAmount, toDecimal, unitsToCents } from '../src/logic/money.ts'
import { aggregate, averageBuyUnits, buyTotal, feeUnits, portfolioValue, sellProceeds, spread, unrealisedPnl, validateOrder, walkAsks, walkBids } from '../src/logic/orders.ts'
import type { Rules } from '../src/logic/orders.ts'
import { decodeError, initialTx, stepSeconds, txReducer } from '../src/logic/txMachine.ts'
import { valueSeries, change } from '../src/logic/portfolioMath.ts'
import { bucketFor, bucketOHLC, inRange, startOfDay, summary } from '../src/logic/chartMath.ts'
import { failoverFetch } from '../src/logic/failover.ts'

const U = 1_000_000n // one dollar in base units

// ---------------------------------------------------------------- money
test('divRound: every mode, positive and negative, on and off the boundary', () => {
  assert.equal(divRound(7n, 2n, 'floor'), 3n)
  assert.equal(divRound(7n, 2n, 'ceil'), 4n)
  assert.equal(divRound(7n, 2n, 'halfUp'), 4n) // 3.5 rounds up
  assert.equal(divRound(5n, 2n, 'halfUp'), 3n)
  assert.equal(divRound(-7n, 2n, 'floor'), -4n)
  assert.equal(divRound(-7n, 2n, 'ceil'), -3n)
  assert.equal(divRound(-7n, 2n, 'halfUp'), -4n) // away from zero, the mirror of +3.5 -> 4
  assert.equal(divRound(4n, 2n, 'floor'), 2n)
  assert.equal(divRound(0n, 5n, 'ceil'), 0n)
  assert.throws(() => divRound(1n, 0n, 'floor'))
})

test('toDecimal and parseAmount are exact and inverse', () => {
  assert.equal(toDecimal(5150n * U), '5150.000000')
  assert.equal(toDecimal(1n), '0.000001')
  assert.equal(toDecimal(-1_500_000n), '-1.500000')
  assert.equal(parseAmount('$5,150'), 5150n * U)
  assert.equal(parseAmount('0.000001'), 1n)
  assert.equal(parseAmount('1.2345678'), undefined) // more places than the unit holds: rejected, not rounded
  assert.equal(parseAmount('abc'), undefined)
  assert.equal(parseAmount(''), undefined)
  for (const n of [0n, 1n, 999_999n, 123_456_789_000_000n]) assert.equal(parseAmount(toDecimal(n)), n)
})

test('cents and units convert both ways', () => {
  assert.equal(centsToUnits(515_000n), 5150n * U)
  assert.equal(unitsToCents(5150n * U, 'floor'), 515_000n)
  assert.equal(unitsToCents(1_005_000n, 'halfUp'), 101n) // 100.5 cents
  assert.equal(unitsToCents(1_004_999n, 'halfUp'), 100n)
  assert.equal(unitsToCents(1_004_999n, 'ceil'), 101n)
})

test('formatUsd: whole dollars, cents, huge values, rounding mode, sign', () => {
  assert.equal(formatUsd(5150n * U, { locale: 'en-US' }), '$5,150')
  assert.equal(formatUsd(5150n * U + 500_000n, { locale: 'en-US' }), '$5,150.50')
  assert.equal(formatUsd(12_345_678n * U, { locale: 'en-US' }), '$12,345,678')
  assert.equal(formatUsd(0n, { locale: 'en-US' }), '$0')
  assert.equal(formatUsd(1n, { locale: 'en-US', digits: 2, rounding: 'halfUp' }), '$0.00')
  assert.equal(formatUsd(1n, { locale: 'en-US', digits: 2, rounding: 'ceil' }), '$0.01')
  assert.equal(formatUsd(1_005_000n, { locale: 'en-US', digits: 2, rounding: 'halfUp' }), '$1.01') // exact half goes up
  assert.equal(formatUsd(1_005_000n, { locale: 'en-US', digits: 2, rounding: 'floor' }), '$1.00')
  assert.equal(formatUsd(2n * U, { locale: 'en-US', sign: 'always' }), '+$2')
  assert.equal(formatUsd(-2n * U, { locale: 'en-US' }), '−$2')
  assert.equal(formatUsd(9_007_199_254_740_993n * U, { locale: 'en-US' }), '$9,007,199,254,740,993') // past 2^53, no float
  assert.equal(formatUsd(5150n * U, { locale: 'de-DE' }).replace(/\s/g, ' '), '5.150 $')
})

test('formatBps', () => {
  assert.equal(formatBps(580n, { locale: 'en-US' }), '5.8%')
  assert.equal(formatBps(0n, { locale: 'en-US' }), '0.0%')
  assert.equal(formatBps(-250n, { locale: 'en-US', digits: 0 }), '−3%')
})

// ---------------------------------------------------------------- orders
const asks = [
  { price: 515_000n, size: 1n },
  { price: 520_000n, size: 2n },
  { price: 530_000n, size: 3n },
]
const bids = [
  { price: 485_000n, size: 1n },
  { price: 480_000n, size: 4n },
]

test('walkAsks: one unit, many levels, thin book, empty book', () => {
  const one = walkAsks(asks, 1n)
  assert.equal(one.units, 5150n * U)
  assert.equal(one.avgCents, 515_000n)
  assert.equal(one.levels, 1)
  const three = walkAsks(asks, 3n) // 1 @ 5150 + 2 @ 5200
  assert.equal(three.units, (515_000n + 2n * 520_000n) * 10_000n)
  assert.equal(three.avgCents, 518_333n) // 5183.33 rounded half up
  assert.equal(three.limitCents, 520_000n)
  assert.equal(three.levels, 2)
  const thin = walkAsks(asks, 10n)
  assert.equal(thin.qty, 6n)
  assert.equal(thin.short, 4n)
  assert.equal(walkAsks([], 1n).qty, 0n)
  assert.equal(walkAsks([], 1n).avgCents, 0n)
})

test('walkAsks sorts its own input and ignores empty levels', () => {
  const w = walkAsks([{ price: 530_000n, size: 1n }, { price: 100n, size: 0n }, { price: 515_000n, size: 1n }], 1n)
  assert.equal(w.avgCents, 515_000n)
})

test('walkBids sells into the highest bid first', () => {
  const w = walkBids(bids, 2n) // 1 @ 4850 + 1 @ 4800
  assert.equal(w.units, (485_000n + 480_000n) * 10_000n)
  assert.equal(w.limitCents, 480_000n)
  assert.equal(w.avgCents, 482_500n)
})

test('fees round up and totals reconcile', () => {
  assert.equal(feeUnits(5150n * U, 0n), 0n)
  assert.equal(feeUnits(1n, 1n), 1n) // 0.0001 base units rounds up to 1: never under-collected
  assert.equal(feeUnits(10_000n * U, 30n), 30n * U)
  assert.equal(buyTotal(5150n * U, 30n), 5150n * U + feeUnits(5150n * U, 30n))
  assert.equal(sellProceeds(5150n * U, 30n), 5150n * U - feeUnits(5150n * U, 30n))
  assert.equal(buyTotal(5150n * U, 0n), 5150n * U)
})

test('spread: gap as a share of the ask, and absent when a side is missing', () => {
  assert.deepEqual(spread(515_000n, 485_000n), { cents: 30_000n, bps: 583n }) // 5.83%
  assert.equal(spread(undefined, 485_000n), undefined)
  assert.equal(spread(515_000n, undefined), undefined)
  assert.equal(spread(0n, 0n), undefined)
  assert.deepEqual(spread(100n, 100n), { cents: 0n, bps: 0n })
  assert.deepEqual(spread(100n, 120n), { cents: -20n, bps: -2000n }) // crossed book is shown, not hidden
})

test('P&L, average cost and portfolio value reconcile', () => {
  const avg = averageBuyUnits([
    { price: 400_000n, size: 1n, mine: 'buy' },
    { price: 500_000n, size: 2n, mine: 'buy' },
    { price: 900_000n, size: 1n, mine: 'sell' },
    { price: 100n, size: 1n, mine: undefined },
  ])!
  assert.equal(avg.qty, 3n)
  assert.equal(avg.avgUnits, divRound((400_000n + 1_000_000n) * 10_000n, 3n, 'halfUp'))
  assert.equal(averageBuyUnits([]), undefined)
  assert.equal(unrealisedPnl(3n, avg.avgUnits, 5000n * U), 3n * (5000n * U - avg.avgUnits))
  assert.equal(unrealisedPnl(0n, 1n, 1n), 0n)
  const v = portfolioValue([{ qty: 2n, markCents: 485_000n }, { qty: 1n }], 100n * U)
  assert.equal(v.cards, 9700n * U)
  assert.equal(v.total, 9800n * U)
  assert.equal(v.unmarked, 1)
})

test('aggregate: sorted, merged by price, cumulative, depth share', () => {
  const a = aggregate([{ price: 520_000n, size: 1n }, { price: 515_000n, size: 1n }, { price: 520_000n, size: 2n }], 'ask')
  assert.deepEqual(a.map((r) => [r.price, r.size, r.cumulative]), [[515_000n, 1n, 1n], [520_000n, 3n, 4n]])
  assert.equal(a[1].depthBps, 10_000n)
  const b = aggregate(bids, 'bid')
  assert.equal(b[0].price, 485_000n)
  assert.equal(aggregate([], 'bid').length, 0)
})

const rules: Rules = { tickCents: 1n, minSize: 1n, maxSize: 1000n, takerBps: 0n, makerBps: 0n }
test('validateOrder: each rule, and a clean order', () => {
  const base = { side: 'buy' as const, kind: 'limit' as const, priceCents: 485_000n, size: 1n, rules, cashUnits: 5000n * U, cards: 0n }
  assert.deepEqual(validateOrder(base), [])
  assert.equal(validateOrder({ ...base, priceCents: 0n })[0].code, 'price')
  assert.equal(validateOrder({ ...base, rules: { ...rules, tickCents: 5n }, priceCents: 485_001n })[0].code, 'tick')
  assert.equal(validateOrder({ ...base, size: 0n })[0].code, 'min')
  assert.equal(validateOrder({ ...base, size: 1001n })[0].code, 'max')
  assert.ok(validateOrder({ ...base, cashUnits: 10n * U }).some((p) => p.code === 'cash'))
  assert.ok(validateOrder({ ...base, side: 'sell', cards: 0n }).some((p) => p.code === 'tokens'))
  assert.equal(validateOrder({ ...base, side: 'sell', cards: 1n }).length, 0)
  assert.ok(validateOrder({ ...base, gasWei: 1n, gasNeededWei: 10n }).some((p) => p.code === 'gas'))
  assert.equal(validateOrder({ ...base, gasNeededWei: undefined }).length, 0) // fees covered: no gas check
  assert.ok(validateOrder({ ...base, kind: 'market', reviewedCents: 100n, currentCents: 101n }).some((p) => p.code === 'stale'))
  assert.equal(validateOrder({ ...base, kind: 'market', reviewedCents: 100n, currentCents: 100n }).length, 0)
})

// ---------------------------------------------------------------- transaction machine
const two = () => initialTx([{ id: 'approve', label: 'Allow the market to use your USDC' }, { id: 'buy', label: 'Buy' }])

test('happy path: review, confirm, send, confirm each step, reconcile, done', () => {
  let s = two()
  assert.equal(s.phase, 'review')
  s = txReducer(s, { type: 'confirm', at: 1000 })
  assert.equal(s.phase, 'confirming')
  assert.equal(s.steps[0].status, 'confirm')
  s = txReducer(s, { type: 'passkey-ok' })
  assert.equal(s.phase, 'running')
  s = txReducer(s, { type: 'sent', index: 0, hash: '0xa', at: 2000 })
  s = txReducer(s, { type: 'confirmed', index: 0, block: 10n, at: 2900 })
  assert.equal(stepSeconds(s.steps[0]), 0.9)
  assert.equal(s.phase, 'running')
  assert.equal(s.steps[1].status, 'confirm')
  s = txReducer(s, { type: 'sent', index: 1, hash: '0xb', at: 3000 })
  s = txReducer(s, { type: 'confirmed', index: 1, block: 11n, at: 3800 })
  assert.equal(s.phase, 'updating') // not done until the app has reconciled from chain data
  s = txReducer(s, { type: 'reconciled', at: 4000 })
  assert.equal(s.phase, 'done')
  assert.equal(s.updatedAt, 4000)
})

test('init starts a fresh review for a new action', () => {
  const s = txReducer(two(), { type: 'init', steps: [{ id: 'x', label: 'X' }] })
  assert.equal(s.phase, 'review')
  assert.equal(s.steps.length, 1)
})

test('actions out of order are ignored', () => {
  const s = two()
  assert.equal(txReducer(s, { type: 'reconciled', at: 1 }), s)
  assert.equal(txReducer(s, { type: 'passkey-ok' }), s)
  assert.equal(txReducer(s, { type: 'back-to-review' }), s)
})

test('every failure branch lands in failed, and a retry goes back to a fresh review', () => {
  for (const kind of ['rejected', 'reverted', 'price-moved', 'dropped', 'unknown'] as const) {
    let s = txReducer(txReducer(two(), { type: 'confirm', at: 1 }), { type: 'passkey-ok' })
    s = txReducer(s, { type: 'fail', failure: { kind, message: 'm', next: 'n', feeSpent: null } })
    assert.equal(s.phase, 'failed')
    assert.equal(s.failure?.kind, kind)
    const again = txReducer(s, { type: 'back-to-review' })
    assert.equal(again.phase, 'review')
    assert.ok(again.steps.every((x) => x.status === 'todo' && x.hash === undefined)) // nothing resent, nothing carried over
  }
})

test('decodeError: rejection, price moved, reverted with and without a fee, unknown', () => {
  assert.equal(decodeError(Object.assign(new Error('x'), { name: 'NotAllowedError' })).kind, 'rejected')
  assert.equal(decodeError(new Error('User rejected the request')).feeSpent, false)
  const moved = decodeError(new Error('whatever'), { reviewedCents: 100n, currentCents: 120n })
  assert.equal(moved.kind, 'price-moved')
  assert.equal(moved.newCents, 120n)
  assert.equal(decodeError(new Error('execution reverted: insufficient balance for transfer')).feeSpent, false)
  assert.equal(decodeError(new Error('ERC20: transfer amount exceeds balance'), { mined: true }).feeSpent, true)
  assert.equal(decodeError(new Error('FOK order not filled')).kind, 'price-moved')
  assert.equal(decodeError(new Error('replacement transaction underpriced')).kind, 'dropped')
  assert.equal(decodeError(new Error('Timed out while waiting for the receipt')).feeSpent, null)
  assert.equal(decodeError(new Error('???'), { mined: true }).feeSpent, true)
  const unknown = decodeError(new Error('???'))
  assert.equal(unknown.kind, 'unknown')
  assert.equal(unknown.feeSpent, null) // never claims a fee was or was not spent when it cannot know
  assert.match(unknown.message, /could not read/)
})

// ---------------------------------------------------------------- chart maths
const T = (t: number, p: bigint, s = 1n) => ({ t, price: p, size: s })
const NOW = 1_800_000_000

test('inRange filters, sorts and never alters trades; empty and single ranges', () => {
  const trades = [T(NOW - 10, 3n), T(NOW - 2 * 86_400, 2n), T(NOW - 400 * 86_400, 1n)]
  assert.deepEqual(inRange(trades, '1D', NOW).map((x) => x.price), [3n])
  assert.deepEqual(inRange(trades, '1W', NOW).map((x) => x.price), [2n, 3n])
  assert.deepEqual(inRange(trades, '1Y', NOW).map((x) => x.price), [2n, 3n])
  assert.deepEqual(inRange(trades, 'All', NOW).map((x) => x.price), [1n, 2n, 3n])
  assert.equal(inRange([], 'All', NOW).length, 0)
  assert.equal(inRange([T(NOW + 100, 1n)], 'All', NOW).length, 0) // the future is not a trade yet
})

test('startOfDay respects the time zone, including a half-hour zone', () => {
  const t = Date.UTC(2026, 9, 7, 3, 30) / 1000 // 03:30 UTC on 7 Oct
  assert.equal(startOfDay(t, 'UTC'), Date.UTC(2026, 9, 7) / 1000)
  assert.equal(startOfDay(t, 'America/New_York'), Date.UTC(2026, 9, 6, 4) / 1000) // still 6 Oct at 23:30 EDT
  assert.equal(startOfDay(t, 'Asia/Kolkata'), Date.UTC(2026, 9, 6, 18, 30) / 1000) // 09:00 IST on 7 Oct
})

test('startOfDay across a daylight saving change', () => {
  const t = Date.UTC(2026, 2, 8, 12) / 1000 // New York springs forward on 8 Mar 2026
  assert.equal(startOfDay(t, 'America/New_York'), Date.UTC(2026, 2, 8, 5) / 1000)
  const after = Date.UTC(2026, 2, 9, 12) / 1000
  assert.equal(startOfDay(after, 'America/New_York'), Date.UTC(2026, 2, 9, 4) / 1000)
})

test('bucketOHLC: open, high, low, close, volume, and gaps stay gaps', () => {
  const day0 = Date.UTC(2026, 9, 1) / 1000
  const trades = [T(day0 + 100, 10n, 1n), T(day0 + 200, 14n, 2n), T(day0 + 300, 8n, 1n), T(day0 + 5 * 86_400 + 10, 9n, 3n)]
  const c = bucketOHLC(trades, 'day', 'UTC')
  assert.equal(c.length, 2) // four empty days between are omitted, not filled
  assert.deepEqual([c[0].open, c[0].high, c[0].low, c[0].close, c[0].volume, c[0].n], [10n, 14n, 8n, 8n, 4n, 3])
  assert.equal(c[1].t, day0 + 5 * 86_400)
  assert.equal(bucketOHLC([], 'day', 'UTC').length, 0)
  assert.equal(bucketOHLC([T(day0, 5n)], 'hour', 'UTC')[0].open, 5n)
})

test('bucketFor only aggregates when density warrants it', () => {
  assert.equal(bucketFor('1M', 300), undefined)
  assert.equal(bucketFor('1M', 301), 'day')
  assert.equal(bucketFor('1D', 500), 'hour')
  assert.equal(bucketFor('All', 0), undefined)
})

test('summary: one sentence with change, high, low and count', () => {
  const f = (c: bigint) => `$${c / 100n}`
  assert.equal(summary([], f, 'in the last week'), 'No trades in the last week.')
  assert.equal(summary([T(1, 10_000n)], f, 'all time'), '1 trade all time. The price was unchanged. High $100, low $100.')
  assert.equal(summary([T(1, 10_000n), T(2, 20_000n), T(3, 5_000n)], f, 'all time'), '3 trades all time. The price fell from $100 to $50. High $200, low $50.')
})

// ---------------------------------------------------------------- portfolio value over time
test('valueSeries: quantity worked back from today, marks from last sale, starts once every market has a mark', () => {
  // one card held now, bought at t=20 for $100; the market first traded at t=10 at $90 and at t=30 at $120
  const m = { qtyNow: 1n, fills: [{ t: 10, priceCents: 9000n, size: 1n }, { t: 20, priceCents: 10_000n, size: 1n, mine: 'buy' as const }, { t: 30, priceCents: 12_000n, size: 1n }] }
  const s = valueSeries([m])
  assert.deepEqual(s.map((p) => [p.t, p.units]), [[10, 0n], [20, 100n * U], [30, 120n * U]]) // at t=10 the card was not yet held
  // a market with no fills has no mark, so nothing is drawn: no value is invented
  assert.deepEqual(valueSeries([m, { qtyNow: 1n, fills: [] }]), [])
  assert.deepEqual(valueSeries([{ qtyNow: 0n, fills: m.fills }]), [])
  // a card that arrived by vaulting (no fill of ours) counts from the start
  const v = valueSeries([{ qtyNow: 2n, fills: [{ t: 5, priceCents: 1000n, size: 1n }, { t: 6, priceCents: 2000n, size: 1n }] }])
  assert.equal(v[0].units, 2n * 10n * U)
  // a later sale of ours means the card was still held before it
  const sold = valueSeries([{ qtyNow: 0n, fills: [] }, { qtyNow: 1n, fills: [{ t: 1, priceCents: 100n, size: 1n }, { t: 2, priceCents: 200n, size: 1n, mine: 'sell' as const }] }])
  assert.equal(sold[0].units, 2n * U) // before our sale we held two at $1; one is held now
  assert.equal(sold[1].units, 2n * U)
})

test('change over a period uses the value at its start', () => {
  const pts = [{ t: 10, units: 100n * U }, { t: 20, units: 150n * U }, { t: 30, units: 120n * U }]
  assert.equal(change(pts, 0)!.units, 20n * U) // first to last
  assert.equal(change(pts, 25)!.units, -30n * U) // from the last point before 25 (150) to 120
  assert.equal(change(pts, 25)!.bps, -2000n)
  assert.equal(change(pts, 99), undefined)
  assert.equal(change([{ t: 5, units: U }], 0), undefined) // one point is not a change
  assert.equal(change([], 0), undefined)
})

// ---- write failover: a transaction must leave the dead endpoint, and stay put once it finds a live one ----

const res = (status: number) => new Response('{}', { status })
const recorder = (plan: Record<string, number | 'throw'>) => {
  const seen: string[] = []
  const impl = (async (url: string | URL | Request) => {
    const u = String(url)
    seen.push(u)
    const r = plan[u]
    if (r === 'throw') throw new Error('connection refused')
    return res(r ?? 200)
  }) as unknown as typeof fetch
  return { seen, impl }
}
const URLS = ['https://a.example', 'https://b.example', 'https://c.example']

test('failover: a throttled endpoint hands off to the next one', async () => {
  const { seen, impl } = recorder({ 'https://a.example': 429 })
  const f = failoverFetch(URLS, impl)
  assert.equal((await f('')).status, 200)
  assert.deepEqual(seen, ['https://a.example', 'https://b.example'])
  assert.equal(f.pinnedUrl(), 'https://b.example')
})

test('failover: a connection error hands off too', async () => {
  const { impl } = recorder({ 'https://a.example': 'throw' })
  const f = failoverFetch(URLS, impl)
  assert.equal((await f('')).status, 200)
  assert.equal(f.pinnedUrl(), 'https://b.example')
})

test('failover: later calls stay on the endpoint that answered, so a send and its receipt agree', async () => {
  const { seen, impl } = recorder({ 'https://a.example': 429 })
  const f = failoverFetch(URLS, impl)
  await f('') // moves to b
  seen.length = 0
  await f('') // the receipt poll must not go back to a
  await f('')
  assert.deepEqual(seen, ['https://b.example', 'https://b.example'])
})

test('failover: a contract revert is an answer, not a dead endpoint', async () => {
  // reverts come back HTTP 200 with a JSON-RPC error, and must never move the pin
  const { seen, impl } = recorder({})
  const f = failoverFetch(URLS, impl)
  await f('')
  await f('')
  assert.deepEqual(seen, ['https://a.example', 'https://a.example'])
  assert.equal(f.pinnedUrl(), 'https://a.example')
})

test('failover: every endpoint down throws rather than returning a bad response', async () => {
  const { impl } = recorder({ 'https://a.example': 503, 'https://b.example': 429, 'https://c.example': 'throw' })
  const f = failoverFetch(URLS, impl)
  await assert.rejects(() => f(''))
})
