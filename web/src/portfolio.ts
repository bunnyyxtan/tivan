import type { Address } from 'viem'
import { erc20Abi, loadSkus, marginAbi, marginAccount, openOrders, pub, type Order, type Sku } from './chain'
import { net } from './config'
import { usePoll } from './ui'

export type Holding = { s: Sku; wallet: bigint; onBook: bigint; listed: number; count: number }
export type Portfolio = {
  ma: Address
  gas: bigint
  cash: number // dollars in the wallet
  exCash: number // dollars free on the Kuru margin account
  exCashRaw: bigint
  holdings: Holding[] // every SKU, owned or not
}

const dollars = (x: bigint) => Number(x) / 10 ** net.quoteDecimals

/** Balances for one account: cash (wallet + exchange) and each card held in the wallet or on the exchange. */
async function load(me: Address): Promise<Portfolio> {
  const ma = await marginAccount()
  const [gas, cash, mCash, skus] = await Promise.all([
    pub.getBalance({ address: me }),
    pub.readContract({ address: net.quote, abi: erc20Abi, functionName: 'balanceOf', args: [me] }),
    pub.readContract({ address: ma, abi: marginAbi, functionName: 'getBalance', args: [me, net.quote] }),
    loadSkus(),
  ])
  const holdings = await Promise.all(
    skus.map(async (s) => {
      const [wallet, onBook] = await Promise.all([
        pub.readContract({ address: s.token, abi: erc20Abi, functionName: 'balanceOf', args: [me] }),
        pub.readContract({ address: ma, abi: marginAbi, functionName: 'getBalance', args: [me, s.token] }),
      ])
      return { s, wallet, onBook, listed: 0, count: Number(wallet + onBook) }
    }),
  )
  return { ma, gas, cash: dollars(cash), exCash: dollars(mCash), exCashRaw: mCash, holdings }
}

// Several components show balances at once (cash pill, page); they share one read per few seconds.
let cached: { me: Address; t: number; p: Promise<Portfolio> } | undefined
const shared = (me: Address) => {
  if (!cached || cached.me !== me || Date.now() - cached.t > 4000) cached = { me, t: Date.now(), p: load(me) }
  cached.p.catch(() => (cached = undefined))
  return cached.p
}

/** Balances for `me`. Open orders cost a log scan per market, so only pages that list them ask for them. */
export function usePortfolio(me: Address | undefined, withOrders = false) {
  const p = usePoll(async () => (me ? shared(me) : undefined), 6000, [me])
  // Resting orders lock cards and cash outside both balances; a separate, slower poll because the first scan is slow.
  const o = usePoll(
    async () => (me && withOrders ? (Object.fromEntries(await Promise.all((await loadSkus()).map(async (s) => [s.sku, await openOrders(s.market, me)] as const))) as Record<string, Order[]>) : undefined),
    10000,
    [me, withOrders],
  )
  const orders = o.data
  const holdings = (p.data?.holdings ?? []).map((h) => {
    const listed = (orders?.[h.s.sku] ?? []).filter((x) => !x.isBuy).reduce((n, x) => n + x.size, 0)
    return { ...h, listed, count: h.count + listed }
  })
  const bidCash = Object.values(orders ?? {})
    .flat()
    .filter((x) => x.isBuy)
    .reduce((t, x) => t + x.price * x.size, 0)
  return {
    data: p.data && { ...p.data, holdings },
    orders,
    bidCash,
    /** Everything spendable or locked in bids. */
    totalCash: p.data ? p.data.cash + p.data.exCash + bidCash : undefined,
    error: p.error,
    refresh: () => ((cached = undefined), p.refresh(), o.refresh()),
  }
}
