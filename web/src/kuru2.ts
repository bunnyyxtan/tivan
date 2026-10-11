import { erc20Abi, parseUnits, zeroAddress, type Account, type Address, type Chain, type PublicClient, type Transport, type WalletClient } from 'viem'
import { accountCoreV2Abi, orderBookV2Abi, spotRouterV2Abi } from './kuru2Abi.ts'

// Kuru Spot V2 on Monad testnet. Custody sits in AccountCore under a numeric root account id per owner; each market is an
// OrderBook proxy. Market creation and token whitelisting are permissioned on V2, so card markets are deployed by Kuru
// with CARD_PARAMS, and Tivan finds them by asking the router for the deterministic address of each card token's market.
// Pure functions over viem clients, so the app, scripts and tests share them. Addresses: docs/deployments/testnet.
export const V2 = {
  core: '0xdbaaDe7B42c95399bb1E9614D51B5B9e2cf78038' as Address,
  router: '0xf75A7529b83941e001d7D9bc113A73C92112947E' as Address,
  usdc: '0xA402B424f392EAA05DBc8779e4502A1F6A96fEF1' as Address,
}

/** The configuration Tivan asks Kuru to deploy each card market with: prices in cents, whole cards, $1 to $5M per order. */
export const CARD_PARAMS = {
  sizePrecision: 1n,
  pricePrecision: 100,
  tickSize: 1,
  passiveSpreadTicks: 10,
  minQuoteNotional: 1_000_000n,
  maxQuoteNotional: 5_000_000_000_000n,
  takerFeePps: 0n,
  makerFeePps: 0n,
} as const

type Pub = PublicClient<Transport, Chain>
type Wallet = WalletClient<Transport, Chain, Account>

export type V2Market = {
  address: Address
  base: Address
  quote: Address
  pricePrecision: number
  sizePrecision: bigint
  tickSize: number
  minQuote: bigint
  maxQuote: bigint
  takerPps: bigint
  makerPps: bigint
  /** Raw base atoms per unit of book quantity. */
  mult: bigint
}
export type V2Level = { price: number; size: number }
export type V2Order = { side: 'buy' | 'sell'; price: string; size: string; postOnly?: boolean; tif?: 'gtc' | 'ioc' | 'fok' }

const decimalsOf = (precision: bigint | number) => {
  const s = String(precision)
  if (!/^10*$/.test(s)) throw new Error(`unsupported precision ${s}`)
  return s.length - 1
}

/** The V2 market of each card token Kuru has deployed with CARD_PARAMS. Two reads for any number of tokens. */
export async function findCardMarkets(pub: Pub, tokens: Address[]): Promise<Map<string, Address>> {
  const p = CARD_PARAMS
  const predicted = await Promise.all(
    tokens.map((t) =>
      pub.readContract({ address: V2.router, abi: spotRouterV2Abi, functionName: 'computeAddress', args: [t, V2.usdc, p.sizePrecision, p.pricePrecision, p.tickSize, p.passiveSpreadTicks, p.minQuoteNotional, p.maxQuoteNotional, p.takerFeePps, p.makerFeePps] }),
    ),
  )
  const live = await Promise.all(predicted.map((m) => pub.readContract({ address: V2.router, abi: spotRouterV2Abi, functionName: 'verifiedSpotMarket', args: [m] })))
  return new Map(tokens.flatMap((t, i) => (live[i] ? [[t.toLowerCase(), predicted[i]] as [string, Address]] : [])))
}

export async function readMarket(pub: Pub, address: Address): Promise<V2Market> {
  const [params, base, quote, mult] = await Promise.all([
    pub.readContract({ address, abi: orderBookV2Abi, functionName: 'getMarketParams' }),
    pub.readContract({ address, abi: orderBookV2Abi, functionName: 'baseToken' }),
    pub.readContract({ address, abi: orderBookV2Abi, functionName: 'quoteToken' }),
    pub.readContract({ address, abi: orderBookV2Abi, functionName: 'baseSizeMultiplier' }),
  ])
  const [pricePrecision, sizePrecision, tickSize, minQuote, maxQuote, takerPps, makerPps] = params
  return { address, base, quote, pricePrecision, sizePrecision, tickSize, minQuote, maxQuote, takerPps, makerPps, mult }
}

/** Visible depth in display units: dollars per base unit and base units. Empty sides come back as empty arrays. */
export async function readBook(pub: Pub, m: V2Market, levels = 20): Promise<{ bids: V2Level[]; asks: V2Level[] }> {
  const [bp, bs, ap, as] = await pub.readContract({ address: m.address, abi: orderBookV2Abi, functionName: 'getL2Book', args: [BigInt(levels)] })
  const side = (prices: readonly number[], sizes: readonly bigint[]) =>
    prices.flatMap((p, i) => (p && sizes[i] ? [{ price: p / m.pricePrecision, size: Number(sizes[i]) / Number(m.sizePrecision) }] : []))
  return { bids: side(bp, bs), asks: side(ap, as) }
}

/** An owner's root account id, or 0n before their first deposit registers one. */
export const rootIdOf = (pub: Pub, owner: Address) => pub.readContract({ address: V2.core, abi: accountCoreV2Abi, functionName: 'rootAccountIdOf', args: [owner] }).then(BigInt)

/** Free and order-reserved balances in raw token atoms. */
export async function balanceOf(pub: Pub, rootId: bigint, token: Address) {
  if (!rootId) return { free: 0n, reserved: 0n }
  const id = Number(rootId)
  const [free, reserved] = await Promise.all([
    pub.readContract({ address: V2.core, abi: accountCoreV2Abi, functionName: 'getBalance', args: [id, token] }),
    pub.readContract({ address: V2.core, abi: accountCoreV2Abi, functionName: 'getSpotReservedBalance', args: [id, token] }),
  ])
  return { free, reserved }
}

async function confirm(pub: Pub, hash: `0x${string}`) {
  const r = await pub.waitForTransactionReceipt({ hash, pollingInterval: 250 })
  if (r.status !== 'success') throw new Error(`Transaction reverted (${hash.slice(0, 10)}…)`)
  return r
}

/** Move tokens (or native MON at the zero address) from the wallet into the owner's AccountCore root. */
export async function deposit(pub: Pub, wallet: Wallet, token: Address, amount: bigint) {
  const owner = wallet.account.address
  if (token !== zeroAddress) {
    const allowed = await pub.readContract({ address: token, abi: erc20Abi, functionName: 'allowance', args: [owner, V2.core] })
    if (allowed < amount) await confirm(pub, await wallet.writeContract({ address: token, abi: erc20Abi, functionName: 'approve', args: [V2.core, amount] }))
  }
  const { request } = await pub.simulateContract({ account: wallet.account, address: V2.core, abi: accountCoreV2Abi, functionName: 'deposit', args: [owner, token, amount], value: token === zeroAddress ? amount : 0n })
  return confirm(pub, await wallet.writeContract(request))
}

export async function withdraw(pub: Pub, wallet: Wallet, rootId: bigint, token: Address, amount: bigint) {
  const { request } = await pub.simulateContract({ account: wallet.account, address: V2.core, abi: accountCoreV2Abi, functionName: 'withdraw', args: [Number(rootId), token, amount, wallet.account.address] })
  return confirm(pub, await wallet.writeContract(request))
}

const TIF = { gtc: 0, ioc: 1, fok: 2 } as const
/** One price in book units. Throws if it is off the market's tick, so a bad price never reaches the chain. */
export function rawPrice(m: V2Market, dollars: string) {
  const places = decimalsOf(m.pricePrecision)
  // viem rounds away extra decimals, so $1.234 would quietly become $1.23. Refuse it instead.
  if ((dollars.split('.')[1]?.length ?? 0) > places) throw new Error(`price ${dollars} is finer than this market's ${places} decimal places`)
  const raw = parseUnits(dollars, places)
  if (raw <= 0n || raw > 0xffffffffn || raw % BigInt(m.tickSize) !== 0n) throw new Error(`price ${dollars} is off this market's tick or range`)
  return Number(raw)
}
/** One quantity in book units. Refuses a quantity finer than the market's step, which viem would otherwise round. */
export function bookQty(m: V2Market, units: string) {
  const places = decimalsOf(m.sizePrecision)
  if ((units.split('.')[1]?.length ?? 0) > places) throw new Error(`quantity ${units} is finer than this market trades`)
  return parseUnits(units, places)
}

/** Place native orders. Post-only orders that would cross are skipped by the book rather than reverting. */
export async function placeOrders(pub: Pub, wallet: Wallet, m: V2Market, rootId: bigint, orders: V2Order[], cancelSlots: number[] = []) {
  const native = orders.map((o) => ({
    side: o.side === 'buy' ? 0 : 1,
    quantity: bookQty(m, o.size),
    price: rawPrice(m, o.price),
    tif: TIF[o.tif ?? 'gtc'],
    executionInstruction: o.postOnly ? 1 : 0,
    minSizeAfterBlock: 0,
  }))
  const { request } = await pub.simulateContract({ account: wallet.account, address: m.address, abi: orderBookV2Abi, functionName: 'batch', args: [Number(rootId), native, cancelSlots] })
  return confirm(pub, await wallet.writeContract(request))
}

/** Cancel the given maker slots in one batch. Kuru's cancelAllOrders sweeps every slot, and on Monad, where the whole gas
 *  limit is charged, it needs far more MON than a normal action, so Tivan cancels only the slots that hold orders. */
export async function cancelSlots(pub: Pub, wallet: Wallet, m: V2Market, rootId: bigint, slots: number[]) {
  return placeOrders(pub, wallet, m, rootId, [], slots)
}

/** Exact-input taker trade: buy spends quote atoms for base, sell spends base atoms for quote. Reverts below minOut. */
export async function swap(pub: Pub, wallet: Wallet, m: V2Market, rootId: bigint, isBuy: boolean, amountIn: bigint, minOut: bigint, seconds = 60) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + seconds)
  const { request } = await pub.simulateContract({ account: wallet.account, address: m.address, abi: orderBookV2Abi, functionName: 'swap', args: [Number(rootId), isBuy, amountIn, minOut, deadline] })
  return confirm(pub, await wallet.writeContract(request))
}

/** What an exact-input swap would return now, for previews and the min-out guard. */
export async function estimate(pub: Pub, m: V2Market, isBuy: boolean, amountIn: bigint) {
  const r = await pub.readContract({ address: m.address, abi: orderBookV2Abi, functionName: 'estimateSwap', args: [isBuy, amountIn] })
  return r as unknown as { amountInUsed: bigint; amountOut: bigint }
}

/** The owner's resting orders on a market, by maker slot. Slots are reused, so cancel by slot only with a fresh read. */
export async function openSlots(pub: Pub, m: V2Market, rootId: bigint, slots = 32) {
  if (!rootId) return []
  const ids = await Promise.all(Array.from({ length: slots }, (_, i) => pub.readContract({ address: m.address, abi: orderBookV2Abi, functionName: 'getOrderId', args: [Number(rootId), i] })))
  return ids.flatMap((id, slot) => (id ? [{ slot, orderId: id }] : []))
}
