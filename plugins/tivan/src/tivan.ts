// Shared chain access for the Tivan plugin: the same SlabVault -> Kuru market path the app and the maker bot use.
// Reads go through plain viem on the public RPC; only writes need the Agent Wallet executor.
import { createPublicClient, http, parseAbi, type Address, type PublicClient } from 'viem'
import { monadTestnet } from 'viem/chains'

export const VAULT: Address = '0x998a3116dc9AaDb98AF27B31BeC93441E1991a12'
export const CHAIN_ID = monadTestnet.id

export const bookAbi = parseAbi(['function bestBidAsk() view returns (uint256,uint256)', 'function addBuyOrder(uint32,uint96,bool)'])
const symbolAbi = parseAbi(['function symbol() view returns (string)'])

export type Market = { id: string; card: string; grade: number; market: Address | null }

/** A card's short id comes from its own token symbol, `PSA10-CHZ` -> `CHZ10`, so no list has to be kept here. */
export const idOf = (symbol: string) => {
  const m = /^PSA(\d+(?:\.5)?)-(.+)$/.exec(symbol)
  return m ? `${m[2]}${m[1]}` : symbol
}

/** The vault names a market `PSA 10 Base Set Charizard Holo`; split it into grade and card. */
export const parseLabel = (name: string) => {
  const m = /^(?:PSA|BGS|CGC|SGC) (\d+(?:\.5)?) (.+)$/.exec(name)
  return m ? { grade: Number(m[1]), card: m[2] } : { grade: 0, card: name }
}

/** Every market the vault has listed, discovered from the indexer, with ids read from each card's token on chain.
 * A card listed tomorrow appears here with no plugin update. A market still waiting for its Kuru book has market null. */
export async function listMarkets(client: PublicClient): Promise<Market[]> {
  const { Market: rows } = await gql<{ Market: { id: string; name: string; token: Address }[] }>(
    '{ Market(order_by: { listedAt: asc }, limit: 1000) { id name token } }',
  )
  const symbols = await Promise.all(rows.map((r) => client.readContract({ address: r.token, abi: symbolAbi, functionName: 'symbol' })))
  return rows.map((r, i) => ({ id: idOf(symbols[i]), ...parseLabel(r.name), market: r.id.length === 42 ? (r.id as Address) : null }))
}

export const findMarket = (markets: Market[], id: string) => markets.find((m) => m.id.toLowerCase() === id.toLowerCase())

/** Kuru prices are whole cents in a uint32; sizes are whole cards. */
export const toCents = (dollars: number): number => {
  const cents = Math.round(dollars * 100)
  if (!Number.isFinite(cents) || cents <= 0 || cents > 0xffffffff) throw new Error(`price out of range: ${dollars}`)
  return cents
}

/** A person at a terminal gets the printed table only; --json, --format json/toon or a pipe also gets the data. */
export const forPeople = (flags: Record<string, unknown>) =>
  !flags.json && (flags.format === 'text' || (flags.format === undefined && process.stdout.isTTY === true))

// The public RPC allows 15 requests a second, so concurrent reads are folded into Multicall3 calls.
export const pub = (): PublicClient => createPublicClient({ chain: monadTestnet, batch: { multicall: true }, transport: http() })

const DEAD = 2n ** 255n
/** Kuru returns a sentinel, not 0, when a side of the book is empty. */
export const live = (x: bigint) => x > 0n && x < DEAD

export const INDEXER = process.env.TIVAN_INDEXER ?? 'https://indexer.dev.hyperindex.xyz/73614c1/v1/graphql'
export const orderAbi = parseAbi([
  'function s_orders(uint40) view returns (address owner, uint96 size, uint40 prev, uint40 next, uint40 flippedId, uint32 price, uint32 flippedPrice, bool isBuy)',
])

export type IndexedOrder = { market: Address; orderId: string; priceCents: string; size: string; isBuy: boolean }

/** Open orders for one address, from Tivan's Envio indexer. Liveness is re-checked on chain by the caller. */
export async function indexedOrders(owner: string): Promise<IndexedOrder[]> {
  const body = await gql<{ Order: IndexedOrder[] }>(
    `query($o: String!) { Order(where: {owner: {_eq: $o}}, order_by: {createdAt: desc}, limit: 200) { market orderId priceCents size isBuy } }`,
    { o: owner.toLowerCase() },
  )
  return body.Order ?? []
}

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(INDEXER, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`indexer ${res.status}`)
  const body = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (body.errors?.length) throw new Error(body.errors[0].message)
  if (!body.data) throw new Error('indexer returned no data')
  return body.data
}
