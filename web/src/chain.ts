import { createPublicClient, createWalletClient, encodeAbiParameters, getAddress, http, keccak256, parseAbi, parseAbiItem, type Account, type Address, type Hex } from 'viem'
import { indexerUrl, net } from './config'

// NOTE: public Monad RPCs allow roughly 15-25 requests/sec per IP each (batched calls count individually). Every call
// goes through one client-side limiter with a budget per endpoint: reads take whichever endpoint has room, writes and
// receipts stay on the first so nonces and receipts agree. Rate-limit replies are retried. Limit: a dedicated RPC
// endpoint removes the need.
const sent = new Map<string, { t: number; n: number }[]>()
const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
const room = (e: { url: string; limit: number }, n: number) => {
  const now = Date.now()
  const live = (sent.get(e.url) ?? []).filter((x) => now - x.t < 1000)
  sent.set(e.url, live)
  return e.limit - live.reduce((a, x) => a + x.n, 0) - n
}
async function limitedFetch(_input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  const calls: { method?: string }[] = Array.isArray(body) ? body : body ? [body] : []
  const n = calls.length || 1
  const write = calls.some((c) => /^eth_(send|getTransaction|estimateGas)/.test(c.method ?? ''))
  for (let attempt = 0; ; attempt++) {
    let e = net.rpcs[0]
    for (;;) {
      if (!write) e = net.rpcs.reduce((best, x) => (room(x, n) > room(best, n) ? x : best))
      if (room(e, n) >= 0) break
      await sleep(120)
    }
    sent.get(e.url)!.push({ t: Date.now(), n })
    const res = await fetch(e.url, init)
    if (attempt < 6 && (res.status === 429 || (await res.clone().text()).includes('-32011'))) {
      await sleep(400 * (attempt + 1))
      continue
    }
    return res
  }
}
const transport = http(undefined, {
  batch: { batchSize: 5 },
  fetchFn: limitedFetch,
})
export const pub = createPublicClient({ chain: net.chain, transport })
export const walletFor = (account: Account) => createWalletClient({ account, chain: net.chain, transport })

export const vaultAbi = parseAbi([
  'function skuOf(uint256 specId, uint8 grade) pure returns (bytes32)',
  'function skuInfo(bytes32 sku) view returns (address token, address market, uint256 vaulted)',
  'function certs(uint256) view returns (bytes32 sku, address holder, uint8 status)',
  'function redeem(bytes32 sku, bytes32 shippingHash) returns (uint256 certId)',
  'function linkMarket(bytes32 sku, address market)',
  'event MarketLinked(bytes32 indexed sku, address market)',
  'event Redeemed(uint256 indexed certId, bytes32 indexed sku, address indexed holder, bytes32 shippingHash)',
])
const skuListed = parseAbiItem('event SkuListed(bytes32 indexed sku, address token, address market, string name)')
export const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address, uint256) returns (bool)',
  'function mint(address, uint256)',
])
export const bookAbi = parseAbi([
  'function bestBidAsk() view returns (uint256, uint256)',
  'function getL2Book() view returns (bytes)',
  'function addSellOrder(uint32 price, uint96 size, bool postOnly)',
  'function addBuyOrder(uint32 price, uint96 size, bool postOnly)',
  'function placeAndExecuteMarketBuy(uint96 quoteSize, uint256 minAmountOut, bool isMargin, bool isFillOrKill) payable returns (uint256)',
  'function placeAndExecuteMarketSell(uint96 size, uint256 minAmountOut, bool isMargin, bool isFillOrKill) payable returns (uint256)',
  'event OrderCreated(uint40 orderId, address owner, uint96 size, uint32 price, bool isBuy)',
  'function s_orders(uint40) view returns (address owner, uint96 size, uint40 prev, uint40 next, uint40 flippedId, uint32 price, uint32 flippedPrice, bool isBuy)',
  'function batchCancelOrders(uint40[] orderIds)',
])
export const marginAbi = parseAbi([
  'function deposit(address user, address token, uint256 amount) payable',
  'function withdraw(uint256 amount, address token)',
  'function getBalance(address user, address token) view returns (uint256)',
])
const routerAbi = parseAbi(['function marginAccountAddress() view returns (address)'])

let margin: Promise<Address> | undefined
export const marginAccount = () =>
  (margin ??= pub.readContract({
    address: net.kuruRouter,
    abi: routerAbi,
    functionName: 'marginAccountAddress',
  }))

export const ZERO: Address = '0x0000000000000000000000000000000000000000'
/** Kuru mainnet gates market deployment, so a SKU can exist with market == 0x0 until Kuru lists it (SlabVault.linkMarket). */
export const hasMarket = (s: { market: Address }) => s.market !== ZERO

// SlabVault deploys Kuru markets with sizePrecision 1 (whole cards) and pricePrecision 100 (order prices in cents).

export type Sku = {
  sku: Hex
  token: Address
  market: Address
  name: string
  vaulted: number
  bid?: number
  ask?: number
}

type Listed = { sku: Hex; token: Address; market: Address; name: string }
const scanKey = `slab.skus.${net.chain.id}.${net.vault}`

let scanning: Promise<Listed[]> | undefined
const listedSkus = () => (scanning ??= (indexerUrl ? indexedSkus().catch((e) => (console.warn('indexer down, scanning RPC', e), scan())) : scan()).finally(() => (scanning = undefined)))

/** POST a query to the Envio indexer's GraphQL endpoint. */
async function gql<T>(query: string, variables: object = {}): Promise<T> {
  const res = await fetch(indexerUrl!, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(5000),
  })
  const j = await res.json()
  if (!res.ok || j.errors) throw new Error(j.errors?.[0]?.message ?? `indexer HTTP ${res.status}`)
  return j.data
}

/** Every SKU the vault has listed, from the Envio indexer (SkuListed -> Market rows). */
async function indexedSkus(): Promise<Listed[]> {
  const { Market } = await gql<{ Market: Listed[] }>('{ Market(order_by: { listedAt: asc }) { sku token market: id name } }')
  // A SKU still waiting for its Kuru market is keyed by its bytes32 sku in the indexer.
  return Market.map((m) => (m.market.length === 42 ? m : { ...m, market: ZERO }))
}

/** Every SKU the vault has listed: seeded SKUs now, plus SkuListed logs found by a background scan cached per browser. */
let backfill: Promise<void> | undefined
async function scan(): Promise<Listed[]> {
  const vault = net.vault!
  let cache: { block: string; skus: Listed[] } = {
    block: String(net.deployBlock - 1n),
    skus: [],
  }
  try {
    cache = JSON.parse(localStorage.getItem(scanKey) ?? '') ?? cache
  } catch {}
  const seeds = await Promise.all(
    net.seedSkus.map(async (s) => {
      const sku = keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'uint8' }], [s.specId, s.grade])) // SlabVault.skuOf
      const [token, market] = await pub.readContract({
        address: vault,
        abi: vaultAbi,
        functionName: 'skuInfo',
        args: [sku],
      })
      if (token === '0x0000000000000000000000000000000000000000') return []
      const name = await pub.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'name',
      })
      return [{ sku, token, market, name }]
    }),
  )
  // The log scan only adds SKUs beyond the seeds, so it runs behind the first paint; the next poll picks up what it finds.
  backfill ??= scanLogs(cache)
    .catch((e) => console.warn('log scan failed', e))
    .finally(() => (backfill = undefined))
  return [...new Map([...seeds.flat(), ...cache.skus].map((s) => [s.sku, s])).values()]
}

async function scanLogs(cache: { block: string; skus: Listed[] }) {
  const head = await pub.getBlockNumber()
  // Monad RPC caps eth_getLogs at 100 blocks per call.
  // NOTE: client-side log scan of at most the last 3k blocks (~20 min) per visit; older SKUs come from seedSkus.
  // Limit: a SKU listed >3k blocks before a fresh browser's first visit and not seeded is missed; the Envio indexer replaces this.
  const from = BigInt(cache.block) + 1n > head - 3000n ? BigInt(cache.block) + 1n : head - 3000n
  const ranges: [bigint, bigint][] = []
  for (let b = from; b <= head; b += 100n) ranges.push([b, b + 99n > head ? head : b + 99n])
  const found = [...cache.skus]
  for (let i = 0; i < ranges.length; i += 4) {
    const logs = await Promise.all(ranges.slice(i, i + 4).map(([fromBlock, toBlock]) => pub.getLogs({ address: net.vault!, event: skuListed, fromBlock, toBlock })))
    for (const l of logs.flat()) found.push(l.args as Listed)
  }
  const unique = [...new Map(found.map((s) => [s.sku, s])).values()]
  try {
    localStorage.setItem(scanKey, JSON.stringify({ block: String(head), skus: unique }))
  } catch {}
}

// bestBidAsk is 1e18-scaled; an empty side reads as 0 or uint256 max.
const px = (x: bigint) => (x > 0n && x < 2n ** 255n ? Number(x) / 1e18 : undefined)
let recent: { t: number; p: Promise<Sku[]> } | undefined
/** All SKUs with vault counts and top of book; concurrent/rapid callers share one fetch. */
export function loadSkus(): Promise<Sku[]> {
  if (!recent || Date.now() - recent.t > 3000) recent = { t: Date.now(), p: fetchSkus() }
  recent.p.catch(() => (recent = undefined))
  return recent.p
}
async function fetchSkus(): Promise<Sku[]> {
  if (!net.vault) return []
  const listed = await listedSkus()
  const top = (market: Address) => (market === ZERO ? Promise.resolve([0n, 0n] as const) : pub.readContract({ address: market, abi: bookAbi, functionName: 'bestBidAsk' }))
  return Promise.all(
    listed.map(async (s) => {
      const info = pub.readContract({
        address: net.vault!,
        abi: vaultAbi,
        functionName: 'skuInfo',
        args: [s.sku],
      })
      // skuInfo is the source of truth for the market, so a pending SKU picks up MarketLinked without a log scan.
      const [[, market, vaulted], [bid, ask]] = await Promise.all([info, s.market === ZERO ? info.then(([, m]) => top(m)) : top(s.market)])
      return {
        ...s,
        market,
        vaulted: Number(vaulted),
        bid: px(bid),
        ask: px(ask),
      }
    }),
  )
}

const tradeEvent = parseAbiItem('event Trade(uint40 orderId, address makerAddress, bool isBuy, uint256 price, uint96 updatedSize, address takerAddress, address txOrigin, uint96 filledSize)')
export type Fill = { t: number; price: number; size: number; maker: string; taker: string; takerBuy: boolean }
/** Fills on one card's Kuru market, oldest first: Envio when configured, else the last ~3k blocks of RPC logs. */
export async function tradeHistory(market: Address): Promise<{ fills: Fill[]; source: 'envio' | 'rpc' }> {
  if (market === ZERO) return { fills: [], source: 'rpc' }
  if (indexerUrl) {
    try {
      const { Trade } = await gql<{
        Trade: { priceCents: string; sizeCards: string; timestamp: number; maker: string; taker: string; takerBuy: boolean }[]
      }>('query($m: String!) { Trade(where: { market_id: { _eq: $m } }, order_by: [{ timestamp: asc }, { id: asc }]) { priceCents sizeCards timestamp maker taker takerBuy } }', {
        m: getAddress(market),
      })
      return {
        fills: Trade.map((x) => ({
          t: x.timestamp,
          price: Number(x.priceCents) / 100,
          size: Number(x.sizeCards),
          maker: x.maker.toLowerCase(),
          taker: x.taker.toLowerCase(),
          takerBuy: x.takerBuy,
        })),
        source: 'envio',
      }
    } catch (e) {
      console.warn('indexer down, reading trades from RPC', e)
    }
  }
  // NOTE: RPC fallback only sees the last ~3k blocks (~20 min), 100 blocks per eth_getLogs. Limit: run the indexer.
  const head = await pub.getBlockNumber()
  const start = head - 3000n > net.deployBlock ? head - 3000n : net.deployBlock
  const chunks: Promise<Awaited<ReturnType<typeof pub.getLogs<typeof tradeEvent>>>>[] = []
  for (let b = start; b <= head; b += 100n)
    chunks.push(
      pub.getLogs({
        address: market,
        event: tradeEvent,
        fromBlock: b,
        toBlock: b + 99n > head ? head : b + 99n,
      }),
    )
  const logs = (await Promise.all(chunks)).flat()
  const times = new Map<bigint, number>()
  for (const n of new Set(logs.map((l) => l.blockNumber))) times.set(n, Number((await pub.getBlock({ blockNumber: n })).timestamp))
  return {
    fills: logs.map((l) => ({
      t: times.get(l.blockNumber)!,
      price: Number(l.args.price!) / 1e18,
      size: Number(l.args.filledSize!),
      maker: l.args.makerAddress!.toLowerCase(),
      taker: l.args.takerAddress!.toLowerCase(),
      takerBuy: l.args.isBuy!,
    })),
    source: 'rpc',
  }
}

export type FeedItem = { sku: Hex; name: string; price: number; size: number; taker: string; takerBuy: boolean; t: number }
/** The latest trades across every card, newest first. Envio only: a global feed needs the indexer. */
export async function recentFills(limit = 25): Promise<FeedItem[]> {
  if (!indexerUrl) return []
  try {
    const { Trade } = await gql<{ Trade: { priceCents: string; sizeCards: string; taker: string; takerBuy: boolean; timestamp: number; market: { sku: string; name: string } }[] }>(
      'query($n: Int!) { Trade(order_by: [{ timestamp: desc }, { id: desc }], limit: $n) { priceCents sizeCards taker takerBuy timestamp market { sku name } } }',
      { n: limit },
    )
    return Trade.map((x) => ({ sku: x.market.sku as Hex, name: x.market.name, price: Number(x.priceCents) / 100, size: Number(x.sizeCards), taker: x.taker.toLowerCase(), takerBuy: x.takerBuy, t: x.timestamp }))
  } catch (e) {
    console.warn('indexer down, no global feed', e)
    return []
  }
}

export type Trader = { addr: string; trades: number; founded: number; score: number }
/** Price-league standings: trades made + markets founded, aggregated from the indexer. Envio only. */
export async function leaderboard(): Promise<Trader[]> {
  if (!indexerUrl) return []
  try {
    const { Trade, Order } = await gql<{ Trade: { taker: string }[]; Order: { owner: string; market: string; createdAt: number }[] }>(
      '{ Trade(limit: 1000, order_by: { timestamp: desc }) { taker } Order(limit: 1000, order_by: { createdAt: asc }) { owner market createdAt } }',
    )
    const t = new Map<string, Trader>()
    const get = (a: string) => t.get(a) ?? (t.set(a, { addr: a, trades: 0, founded: 0, score: 0 }), t.get(a)!)
    for (const x of Trade) get(x.taker.toLowerCase()).trades++
    // A wallet "founds" a market if it is the first to post a price there.
    const firstByMarket = new Map<string, string>()
    for (const o of Order) if (!firstByMarket.has(o.market)) firstByMarket.set(o.market, o.owner.toLowerCase())
    for (const owner of firstByMarket.values()) get(owner).founded++
    for (const tr of t.values()) tr.score = tr.trades + tr.founded * 2 // founding a market is worth more than a trade
    return [...t.values()].sort((a, b) => b.score - a.score)
  } catch (e) {
    console.warn('indexer down, no leaderboard', e)
    return []
  }
}

export type Founder = { owner: string; at: number }
/** The first accounts to post a price on one card's market (its founding collectors), oldest first. Envio only. */
export async function foundingCollectors(market: Address, n = 5): Promise<Founder[]> {
  if (!indexerUrl || market === ZERO) return []
  try {
    const { Order } = await gql<{ Order: { owner: string; createdAt: number }[] }>('query($m: String!) { Order(where: { market: { _eq: $m } }, order_by: { createdAt: asc }) { owner createdAt } }', { m: getAddress(market) })
    const seen = new Set<string>()
    const out: Founder[] = []
    for (const o of Order) {
      const owner = o.owner.toLowerCase()
      if (seen.has(owner)) continue
      seen.add(owner)
      out.push({ owner, at: o.createdAt })
      if (out.length >= n) break
    }
    return out
  } catch (e) {
    console.warn('indexer down, no founders', e)
    return []
  }
}

const orderCreated = parseAbiItem('event OrderCreated(uint40 orderId, address owner, uint96 size, uint32 price, bool isBuy)')
export type Order = { id: number; price: number; size: number; isBuy: boolean }
/** This account's resting orders on one market: OrderCreated logs, then s_orders for what is still open. */
const orderScan = new Map<string, { block: bigint; ids: bigint[] }>()
/** Order ids this owner placed on a market: Envio's Order index, or an incremental OrderCreated log scan. */
async function orderIds(market: Address, owner: Address): Promise<bigint[]> {
  if (indexerUrl) {
    try {
      const { Order } = await gql<{ Order: { orderId: string }[] }>('query($m: String!, $o: String!) { Order(where: { market: { _eq: $m }, owner: { _eq: $o } }) { orderId } }', {
        m: getAddress(market),
        o: owner.toLowerCase(),
      })
      return Order.map((o) => BigInt(o.orderId))
    } catch (e) {
      console.warn('indexer down, scanning orders over RPC', e)
    }
  }
  // NOTE: RPC fallback scans OrderCreated from at most ~3k blocks (~20 min) back, then incrementally (in memory).
  // Limit: older resting orders are missed on a fresh page load; the indexer has them all.
  const key = `${market}:${owner}`.toLowerCase()
  const seen = orderScan.get(key) ?? { block: 0n, ids: [] }
  const head = await pub.getBlockNumber()
  let start = seen.block ? seen.block + 1n : head - 3000n
  if (start < net.deployBlock) start = net.deployBlock
  const chunks = []
  for (let b = start; b <= head; b += 100n) chunks.push(pub.getLogs({ address: market, event: orderCreated, fromBlock: b, toBlock: b + 99n > head ? head : b + 99n }))
  const fresh = (await Promise.all(chunks)).flat().filter((l) => l.args.owner?.toLowerCase() === owner.toLowerCase())
  const ids = [...seen.ids, ...fresh.map((l) => BigInt(l.args.orderId!))]
  orderScan.set(key, { block: head, ids })
  return ids
}

/** This account's resting orders on one market; the chain (s_orders) decides what is still open. */
export async function openOrders(market: Address, owner: Address): Promise<Order[]> {
  if (market === ZERO) return []
  const live = await Promise.all(
    (await orderIds(market, owner)).map(async (id) => {
      const [o, size, , , , price, , isBuy] = await pub.readContract({ address: market, abi: bookAbi, functionName: 's_orders', args: [Number(id)] })
      return o.toLowerCase() === owner.toLowerCase() && size > 0n ? [{ id: Number(id), price: price / 100, size: Number(size), isBuy }] : []
    }),
  )
  return live.flat()
}

export type Level = { price: number; size: number }
/** Kuru getL2Book (verified live on testnet): 32-byte block number, then (price, size) words for bids until a zero price, then asks likewise. */
export function decodeL2(data: Hex): { bids: Level[]; asks: Level[] } {
  const words = (data.slice(2).match(/.{64}/g) ?? []).slice(1).map((w) => BigInt('0x' + w))
  const sides: Level[][] = [[], []]
  let side = 0
  for (let i = 0; i < words.length && side < 2; ) {
    if (words[i] === 0n) {
      side++
      i++
      continue
    }
    sides[side].push({
      price: Number(words[i]) / 100,
      size: Number(words[i + 1]),
    }) // L2 prices use pricePrecision (cents); sizes sizePrecision (whole cards)
    i += 2
  }
  return { bids: sides[0], asks: sides[1] }
}

/** Simulate (readable revert reasons), send, wait. */
export async function send(
  account: Account,
  req: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  },
) {
  const { request } = await pub.simulateContract({ account, ...req } as never)
  const hash = await walletFor(account).writeContract(request as never)
  const receipt = await pub.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`Transaction reverted (${hash.slice(0, 10)}…)`)
  return receipt
}

export const explorerTx = (hash: string) => `${net.chain.blockExplorers?.default.url}/tx/${hash}`

/** What `me` last paid for one card on this market, from its fills (taker buy, or a filled bid). */
export const lastPaid = (fills: Fill[], me: string) => {
  const m = me.toLowerCase()
  return fills.filter((f) => (f.taker === m && f.takerBuy) || (f.maker === m && !f.takerBuy)).at(-1)?.price
}
