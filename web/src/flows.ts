// Builds the review for every trading action and the on-chain steps behind it. All amounts are bigint base units and
// come from logic/orders.ts, so the review, the receipt, Activity and Portfolio reconcile to the same numbers.
import type { Address, LocalAccount } from 'viem'
import { bookAbi, erc20Abi, marginAbi, readBook, sendTx, type MarketRules, type Sku } from './chain'
import { net } from './config'
import { centsToUnits, formatBps, formatQty, formatUsd } from './logic/money.ts'
import { buyTotal, feeUnits, sellProceeds, validateOrder, walkAsks, walkBids, type Level, type Problem } from './logic/orders.ts'
import type { ReviewRow, StepSpec, TxSpec } from './tx'
import { MON_PER_TX } from './attestor'

/** What the account holds, in base units, read from chain data. */
export type Funds = { ma: Address; cashRaw: bigint; exCashRaw: bigint; wallet: bigint; onBook: bigint; gas: bigint }
export type Ctx = { account: LocalAccount; s: Sku; label: string; rules: MarketRules; funds: Funds; reconcile: () => Promise<void> }

const usd = (u: bigint, digits: 'auto' | 2 = 'auto') => formatUsd(u, { digits })
// On the test network the panel tops up MON from the faucet before sending, so the form does not block on it.
const gasNeed = (steps: number) => (net.name === 'testnet' ? undefined : MON_PER_TX * BigInt(steps))
const mon = (wei: bigint) => `${(Number(wei) / 1e18).toFixed(2)} MON`
const fees = (rules: MarketRules, amount: bigint, kind: 'taker' | 'maker'): ReviewRow => {
  const bps = kind === 'taker' ? rules.takerBps : rules.makerBps
  return { label: kind === 'taker' ? 'Platform fee' : 'Platform fee when it fills', value: usd(feeUnits(amount, bps), 2), note: `Currently ${formatBps(bps, { digits: 2 })}, read from the market` }
}
const networkFee = (steps: number): ReviewRow => ({ label: 'Network fee', value: `about ${mon(MON_PER_TX * BigInt(steps))}`, note: net.name === 'testnet' ? 'An estimate, paid in MON. Topped up from the test faucet first if you are short.' : 'An estimate, paid in MON. Not part of the order total.' })
const problems = (p: Problem[]) => p.map((x) => x.message)

const approve = (c: Ctx, token: Address, spender: Address, amount: bigint, label: string): StepSpec => ({
  id: `approve-${token}`,
  label,
  run: (h) => sendTx(c.account, { address: token, abi: erc20Abi, functionName: 'approve', args: [spender, amount] }, h),
})

export type Built = { spec?: TxSpec; problems: string[] }

/** Buy now: fills at the lowest ask. Spanning levels shows the average and the worst price; the order is fill-or-kill at the reviewed total. */
export function buyNow(c: Ctx, asks: Level[], qty: bigint): Built {
  const w = walkAsks(asks, qty)
  if (w.qty < qty) return { problems: [w.qty === 0n ? 'No one is selling at this grade.' : `Only ${formatQty(w.qty)} for sale at the moment.`] }
  const total = buyTotal(w.units, c.rules.takerBps)
  const cash = c.funds.cashRaw + c.funds.exCashRaw
  const fromExchange = total > c.funds.cashRaw ? total - c.funds.cashRaw : 0n
  const stepCount = (fromExchange > 0n ? 1 : 0) + 2
  const p = problems(validateOrder({ side: 'buy', kind: 'market', priceCents: w.limitCents, size: qty, rules: c.rules, cashUnits: cash, cards: 0n, gasWei: c.funds.gas, gasNeededWei: gasNeed(stepCount) }))
  if (p.length) return { problems: p }
  const steps: StepSpec[] = []
  if (fromExchange > 0n) steps.push({ id: 'withdraw-cash', label: `Move ${usd(fromExchange)} of your exchange cash to your wallet`, run: (h) => sendTx(c.account, { address: c.funds.ma, abi: marginAbi, functionName: 'withdraw', args: [fromExchange, net.quote] }, h) })
  steps.push(approve(c, net.quote, c.s.market, w.units, `Allow the market to use ${usd(w.units)} of your USDC`))
  // Fill-or-kill on the reviewed total: if the asks moved, it does not fill and nothing is charged.
  steps.push({ id: 'buy', label: `Buy ${formatQty(qty)} ${c.label}`, run: (h) => sendTx(c.account, { address: c.s.market, abi: bookAbi, functionName: 'placeAndExecuteMarketBuy', args: [w.units / centsToUnits(1n), 0n, false, true] }, h) })
  const rows: ReviewRow[] = [
    { label: w.levels > 1 ? 'Average price' : 'Price', value: usd(centsToUnits(w.avgCents), 2) + (qty > 1n ? ' each' : '') },
    ...(w.levels > 1 ? [{ label: 'Worst price', value: usd(centsToUnits(w.limitCents), 2), note: 'The highest ask this order reaches' }] : []),
    { label: 'Quantity', value: formatQty(qty) },
    fees(c.rules, w.units, 'taker'),
    networkFee(stepCount),
  ]
  return {
    problems: [],
    spec: {
      kind: 'buy',
      account: c.account,
      title: `Buy ${c.label}`,
      summary: [`You pay ${usd(total, 2)} and receive ${formatQty(qty)} ${c.label}, held in the vault for you.`],
      rows,
      total: { label: 'You pay', value: usd(total, 2) },
      protection: `Price protection: fill-or-kill at ${usd(w.units, 2)}. If the price moves before it fills, nothing is charged.`,
      confirmLabel: `Buy for ${usd(total)}`,
      steps,
      precheck: async () => ({ reviewedCents: w.limitCents, currentCents: walkAsks((await readBook(c.s.market)).asks, qty).qty === qty ? walkAsks((await readBook(c.s.market)).asks, qty).limitCents : 0n }),
      reconcile: c.reconcile,
      receiptSentence: `Bought ${formatQty(qty)} ${c.label} for ${usd(total, 2)}.`,
      amountUnits: -total,
      sku: c.s.sku,
    },
  }
}

/** Make offer: a limit bid. The cash is reserved until it fills or the user cancels. */
export function makeOffer(c: Ctx, priceCents: bigint, qty: bigint, askCents?: bigint): Built {
  const need = centsToUnits(priceCents) * qty
  const have = c.funds.exCashRaw
  const topUp = need > have ? need - have : 0n
  const stepCount = (topUp > 0n ? 2 : 0) + 1
  const p = problems(validateOrder({ side: 'buy', kind: 'limit', priceCents, size: qty, rules: c.rules, cashUnits: c.funds.cashRaw + c.funds.exCashRaw, cards: 0n, gasWei: c.funds.gas, gasNeededWei: gasNeed(stepCount) }))
  if (askCents !== undefined && priceCents >= askCents) p.push('That price is at or above the ask. Use Buy now to take it.')
  if (p.length) return { problems: p }
  const steps: StepSpec[] = []
  if (topUp > 0n) {
    steps.push(approve(c, net.quote, c.funds.ma, topUp, `Allow the exchange to use ${usd(topUp)} of your USDC`))
    steps.push({ id: 'deposit-cash', label: `Set aside ${usd(topUp)} for this offer`, run: (h) => sendTx(c.account, { address: c.funds.ma, abi: marginAbi, functionName: 'deposit', args: [c.account.address, net.quote, topUp] }, h) })
  }
  steps.push({ id: 'offer', label: `Place your offer of ${usd(centsToUnits(priceCents))}`, run: (h) => sendTx(c.account, { address: c.s.market, abi: bookAbi, functionName: 'addBuyOrder', args: [Number(priceCents), qty, true] }, h) })
  return {
    problems: [],
    spec: {
      kind: 'offer',
      account: c.account,
      title: `Make an offer on ${c.label}`,
      summary: [`Your offer of ${usd(centsToUnits(priceCents), 2)} waits on the order book. If a seller accepts, you pay that price.`, `${usd(need, 2)} of your cash is reserved while it waits. You can cancel any time and it returns to your available cash.`],
      rows: [{ label: 'Offer price', value: usd(centsToUnits(priceCents), 2) }, { label: 'Quantity', value: formatQty(qty) }, { label: 'Reserved while open', value: usd(need, 2) }, fees(c.rules, need, 'maker'), networkFee(stepCount)],
      total: { label: 'Cash reserved', value: usd(need, 2) },
      confirmLabel: `Offer ${usd(centsToUnits(priceCents))}`,
      steps,
      reconcile: c.reconcile,
      receiptSentence: `Offered ${usd(centsToUnits(priceCents), 2)} for ${formatQty(qty)} ${c.label}. ${usd(need, 2)} is reserved until it fills or you cancel.`,
      amountUnits: -need,
      sku: c.s.sku,
    },
  }
}

/** Sell now: into the best offers, fill-or-kill at the reviewed proceeds. */
export function sellNow(c: Ctx, bids: Level[], qty: bigint): Built {
  const w = walkBids(bids, qty)
  if (w.qty < qty) return { problems: [w.qty === 0n ? 'No one is offering on this card yet.' : `Offers cover only ${formatQty(w.qty)} right now.`] }
  const proceeds = sellProceeds(w.units, c.rules.takerBps)
  const held = c.funds.wallet + c.funds.onBook
  const fromExchange = c.funds.wallet < qty ? qty - c.funds.wallet : 0n
  const stepCount = (fromExchange > 0n ? 1 : 0) + 2
  const p = problems(validateOrder({ side: 'sell', kind: 'market', priceCents: w.limitCents, size: qty, rules: c.rules, cashUnits: 0n, cards: held, gasWei: c.funds.gas, gasNeededWei: gasNeed(stepCount) }))
  if (p.length) return { problems: p }
  const steps: StepSpec[] = []
  if (fromExchange > 0n) steps.push({ id: 'withdraw-cards', label: `Bring ${formatQty(fromExchange)} from the exchange to your wallet`, run: (h) => sendTx(c.account, { address: c.funds.ma, abi: marginAbi, functionName: 'withdraw', args: [fromExchange, c.s.token] }, h) })
  steps.push(approve(c, c.s.token, c.s.market, qty, `Allow the market to sell ${formatQty(qty)} ${c.label}`))
  steps.push({ id: 'sell', label: `Sell ${formatQty(qty)} ${c.label}`, run: (h) => sendTx(c.account, { address: c.s.market, abi: bookAbi, functionName: 'placeAndExecuteMarketSell', args: [qty, w.units, false, true] }, h) })
  return {
    problems: [],
    spec: {
      kind: 'sell',
      account: c.account,
      title: `Sell ${c.label}`,
      summary: [`You receive ${usd(proceeds, 2)} in cash and give up ${formatQty(qty)} ${c.label}.`],
      rows: [{ label: w.levels > 1 ? 'Average price' : 'Price', value: usd(centsToUnits(w.avgCents), 2) + (qty > 1n ? ' each' : '') }, ...(w.levels > 1 ? [{ label: 'Lowest price', value: usd(centsToUnits(w.limitCents), 2), note: 'The lowest offer this order reaches' }] : []), { label: 'Quantity', value: formatQty(qty) }, fees(c.rules, w.units, 'taker'), networkFee(stepCount)],
      total: { label: 'You receive', value: usd(proceeds, 2) },
      protection: `Price protection: fill-or-kill with a floor of ${usd(w.units, 2)}. If the offers drop before it fills, nothing is sold.`,
      confirmLabel: `Sell for ${usd(proceeds)}`,
      steps,
      precheck: async () => ({ reviewedCents: w.limitCents, currentCents: walkBids((await readBook(c.s.market)).bids, qty).qty === qty ? walkBids((await readBook(c.s.market)).bids, qty).limitCents : 0n }),
      reconcile: c.reconcile,
      receiptSentence: `Sold ${formatQty(qty)} ${c.label} for ${usd(proceeds, 2)}.`,
      amountUnits: proceeds,
      sku: c.s.sku,
    },
  }
}

/** List at your price: an ask that waits for a buyer. */
export function listAsk(c: Ctx, priceCents: bigint, qty: bigint, bidCents?: bigint): Built {
  const have = c.funds.onBook
  const move = qty > have ? qty - have : 0n
  const stepCount = (move > 0n ? 2 : 0) + 1
  const p = problems(validateOrder({ side: 'sell', kind: 'limit', priceCents, size: qty, rules: c.rules, cashUnits: 0n, cards: c.funds.wallet + c.funds.onBook, gasWei: c.funds.gas, gasNeededWei: gasNeed(stepCount) }))
  if (bidCents !== undefined && priceCents <= bidCents) p.push('That price is at or below the best offer. Use Sell now to take it.')
  if (p.length) return { problems: p }
  const steps: StepSpec[] = []
  if (move > 0n) {
    steps.push(approve(c, c.s.token, c.funds.ma, move, `Allow the exchange to hold ${formatQty(move)} ${c.label}`))
    steps.push({ id: 'deposit-cards', label: `Move ${formatQty(move)} to the exchange`, run: (h) => sendTx(c.account, { address: c.funds.ma, abi: marginAbi, functionName: 'deposit', args: [c.account.address, c.s.token, move] }, h) })
  }
  steps.push({ id: 'list', label: `List at ${usd(centsToUnits(priceCents))}`, run: (h) => sendTx(c.account, { address: c.s.market, abi: bookAbi, functionName: 'addSellOrder', args: [Number(priceCents), qty, true] }, h) })
  const gross = centsToUnits(priceCents) * qty
  return {
    problems: [],
    spec: {
      kind: 'list',
      account: c.account,
      title: `List ${c.label}`,
      summary: [`Your ask of ${usd(centsToUnits(priceCents), 2)} waits on the order book. If a buyer takes it you receive that price, less fees.`, 'You can cancel any time and the card returns to your holdings.'],
      rows: [{ label: 'Ask price', value: usd(centsToUnits(priceCents), 2) }, { label: 'Quantity', value: formatQty(qty) }, fees(c.rules, gross, 'maker'), networkFee(stepCount)],
      total: { label: 'You receive if it fills', value: usd(gross - feeUnits(gross, c.rules.makerBps), 2) },
      confirmLabel: `List at ${usd(centsToUnits(priceCents))}`,
      steps,
      reconcile: c.reconcile,
      receiptSentence: `Listed ${formatQty(qty)} ${c.label} at ${usd(centsToUnits(priceCents), 2)}. It waits on the order book until it sells or you cancel.`,
      amountUnits: gross,
      sku: c.s.sku,
    },
  }
}

/** Cancel an open order: an on-chain action with its own review. */
export function cancelOrder(c: Ctx, o: { id: number; priceCents: bigint; size: bigint; isBuy: boolean }): TxSpec {
  const value = centsToUnits(o.priceCents) * o.size
  return {
    kind: 'cancel',
    account: c.account,
    title: `Cancel your ${o.isBuy ? 'offer' : 'listing'} on ${c.label}`,
    summary: [o.isBuy ? `Your offer of ${usd(centsToUnits(o.priceCents), 2)} is removed and ${usd(value, 2)} returns to your available cash.` : `Your ask of ${usd(centsToUnits(o.priceCents), 2)} is removed and the card stays in your holdings.`],
    rows: [{ label: o.isBuy ? 'Offer price' : 'Ask price', value: usd(centsToUnits(o.priceCents), 2) }, { label: 'Quantity', value: formatQty(o.size) }, networkFee(1)],
    confirmLabel: 'Cancel order',
    steps: [{ id: 'cancel', label: 'Cancel the order', run: (h) => sendTx(c.account, { address: c.s.market, abi: bookAbi, functionName: 'batchCancelOrders', args: [[o.id]] }, h) }],
    reconcile: c.reconcile,
    receiptSentence: `Cancelled your ${o.isBuy ? 'offer' : 'listing'} of ${usd(centsToUnits(o.priceCents), 2)} on ${c.label}.`,
    sku: c.s.sku,
  }
}
