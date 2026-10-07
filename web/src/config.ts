import { monad, monadTestnet } from 'viem/chains'
import type { Address, Chain } from 'viem'

export type Network = {
  name: 'testnet' | 'mainnet'
  chain: Chain
  vault?: Address // undefined until deployed
  deployBlock: bigint
  quote: Address
  quoteSymbol: string
  quoteDecimals: number
  kuruRouter: Address // MarginAccount is read from Router.marginAccountAddress()
  /** Quote token has an open `mint(address,uint256)` (testnet stand-in for USDC). */
  mintableQuote: boolean
  /** Known SKUs, read via skuInfo so the list never depends on scanning old logs. */
  seedSkus: { specId: bigint; grade: number }[]
  /** JSON-RPC endpoints with the requests/second each tolerates; reads spread across them, writes use the first. */
  rpcs: { url: string; limit: number; logs?: boolean }[]
}

const networks: Record<Network['name'], Network> = {
  testnet: {
    name: 'testnet',
    chain: monadTestnet,
    vault: '0x998a3116dc9AaDb98AF27B31BeC93441E1991a12',
    deployBlock: 0x414bda2n,
    quote: '0x8C43e58dFAcF7Ee589b45EB7d0C61559F7413578', // TestUSD
    quoteSymbol: 'USD',
    quoteDecimals: 6,
    kuruRouter: '0x7EFbE105Ca7415dE98F96622173458ac1c054630',
    mintableQuote: true,
    rpcs: [
      { url: 'https://testnet-rpc.monad.xyz', limit: 14 },
      { url: 'https://rpc.ankr.com/monad_testnet', limit: 24, logs: false }, // rejects batched 100-block getLogs ranges
    ],
    seedSkus: [
      { specId: 4n, grade: 10 },
      { specId: 4n, grade: 9 },
      { specId: 58n, grade: 10 },
      { specId: 1993232n, grade: 9 },
      { specId: 2n, grade: 9 },
      { specId: 15n, grade: 9 },
      { specId: 10n, grade: 9 },
      { specId: 1993140n, grade: 8 },
      { specId: 1993180n, grade: 9 },
      { specId: 2002001n, grade: 9 },
      { specId: 2002005n, grade: 9 },
      { specId: 2002124n, grade: 9 },
      { specId: 1909001n, grade: 3 },
      { specId: 1909002n, grade: 4 },
      { specId: 1909003n, grade: 5 },
      { specId: 1911001n, grade: 5 },
      { specId: 1909004n, grade: 4 },
      { specId: 1909005n, grade: 5 },
      { specId: 1933002n, grade: 6 },
    ],
  },
  mainnet: {
    name: 'mainnet',
    chain: monad,
    vault: '0x5ad7d5e06df36415c6f3fA48299Bf92ed921859a',
    deployBlock: 110839553n,
    quote: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', // USDC (Kuru's MON-USDC book is the liquid one)
    quoteSymbol: 'USD',
    quoteDecimals: 6,
    kuruRouter: '0xd651346d7c789536ebf06dc72aE3C8502cd695CC',
    mintableQuote: false,
    rpcs: [{ url: 'https://rpc.monad.xyz', limit: 10 }],
    // DEMO SKUs: tokens named "DEMO …", no physical cards. Kuru mainnet markets are owner-gated, so pending listing.
    seedSkus: [
      { specId: 58n, grade: 10 },
      { specId: 4n, grade: 10 },
      { specId: 1993232n, grade: 9 },
    ],
  },
}

const which = (import.meta.env.VITE_NETWORK ?? 'testnet') as Network['name']
if (!(which in networks)) throw new Error(`VITE_NETWORK must be testnet or mainnet, got ${which}`)
// A dedicated RPC (e.g. a Quicknode endpoint restricted to this site's domain) goes first and carries the writes.
const ownRpc = import.meta.env.VITE_RPC_URL
export const net: Network = ownRpc ? { ...networks[which], rpcs: [{ url: ownRpc, limit: Number(import.meta.env.VITE_RPC_LIMIT) || 40, logs: import.meta.env.VITE_RPC_LOGS === 'true' }, ...networks[which].rpcs] } : networks[which]

/** Every wallet that traded before launch: the market maker, faucet/attestor and our seed and test runs. They quote and seed markets, so they never rank in the League. */
export const house = [
  '0x9037a6733a9bd1641357ae5a12338378d3977911',
  '0xb9a34bd07273913f10012a74521a045e99c79098',
  '0x659d3d5edb7bca50054a4b1f9bb4f6483f61818d',
  '0x317b8059028090aadca1c677ffd90dfdc588fc39',
  '0x8a23a1155f16bea7f7ea6771c43380d1c16a7f2a',
  '0xfc447926d4fb10ef62e24c92086df15a8cefa7ac',
  '0x8e131bd4de8eaa058865255f7272582bb4bf021f',
  '0x52b1672b2c2a8283fcecd57f4507477eb09a1873',
  '0xba0250e333d9b70f823828de7dffc6ec5dcfe467',
  '0x69eb82bc8041277e9f6c9e074a4d0d9429475783',
  '0x09f730d2916e649648faa53ba45262dac8a2d7db',
  '0x49cfd3e052e1369c5c02606c7e92ddcbde11118f',
  '0x8d9907f2899e9648372c3164199e1134f3578397',
]

export const attestorUrl: string = import.meta.env.VITE_ATTESTOR_URL || 'http://localhost:8787'
/** Envio HyperIndex GraphQL (indexer/). Optional: without it the app reads SKUs and trades straight from the RPC. */
export const indexerUrl: string | undefined = import.meta.env.VITE_INDEXER_URL || undefined

/** Cards the demo grader registry knows (cre/fixtures/psa-certs.json). Shown as presets in "Vault a card". */
const BASE = import.meta.env.BASE_URL // '/' in dev, '/<repo>/' on GitHub Pages
export const catalog = [
  { specId: 4n, title: 'Base Set Charizard Holo', set: 'Base Set · 1999', short: 'CHZ', category: 'Pokémon', imageUrl: BASE + 'cards/charizard.webp', tint: 'char' },
  { specId: 58n, title: 'Base Set Pikachu Red Cheeks', set: 'Promo · 1999', short: 'PIKA', category: 'Pokémon', imageUrl: BASE + 'cards/pikachu.webp', tint: 'pika' },
  { specId: 1993232n, title: 'Alpha Black Lotus', set: 'Alpha · 1993', short: 'LOTUS', category: 'Magic', imageUrl: BASE + 'cards/lotus.webp', tint: 'lotus' },
  { specId: 2n, title: 'Base Set Blastoise Holo', set: 'Base Set · 1999', short: 'BLST', category: 'Pokémon', imageUrl: BASE + 'cards/blastoise.webp', tint: 'blue' },
  { specId: 15n, title: 'Base Set Venusaur Holo', set: 'Base Set · 1999', short: 'VENU', category: 'Pokémon', imageUrl: BASE + 'cards/venusaur.webp', tint: 'green' },
  { specId: 10n, title: 'Base Set Mewtwo Holo', set: 'Base Set · 1999', short: 'MEW2', category: 'Pokémon', imageUrl: BASE + 'cards/mewtwo.webp', tint: 'blue' },
  { specId: 1993140n, title: 'Alpha Mox Sapphire', set: 'Alpha · 1993', short: 'MOXS', category: 'Magic', imageUrl: BASE + 'cards/moxsapphire.webp', tint: 'blue' },
  { specId: 1993180n, title: 'Alpha Underground Sea', set: 'Alpha · 1993', short: 'USEA', category: 'Magic', imageUrl: BASE + 'cards/undergroundsea.webp', tint: 'green' },
  { specId: 2002001n, title: 'Legend of Blue Eyes Blue-Eyes White Dragon', set: 'Legend of Blue Eyes · 2002', short: 'BEWD', category: 'Yu-Gi-Oh!', imageUrl: BASE + 'cards/blueeyes.webp', tint: 'blue' },
  { specId: 2002005n, title: 'Legend of Blue Eyes Dark Magician', set: 'Legend of Blue Eyes · 2002', short: 'DKMG', category: 'Yu-Gi-Oh!', imageUrl: BASE + 'cards/darkmagician.webp', tint: 'lbj' },
  { specId: 2002124n, title: 'Legend of Blue Eyes Exodia the Forbidden One', set: 'Legend of Blue Eyes · 2002', short: 'EXOD', category: 'Yu-Gi-Oh!', imageUrl: BASE + 'cards/exodia.webp', tint: 'pika' },
  { specId: 1909001n, title: 'T206 Honus Wagner', set: 'T206 · 1909', short: 'WAGNER', category: 'Sports', imageUrl: BASE + 'cards/wagner.webp', tint: 'pika' },
  { specId: 1909002n, title: 'T206 Ty Cobb', set: 'T206 · 1909', short: 'COBB', category: 'Sports', imageUrl: BASE + 'cards/cobb.webp', tint: 'green' },
  { specId: 1909003n, title: 'T206 Christy Mathewson', set: 'T206 · 1909', short: 'MATHEW', category: 'Sports', imageUrl: BASE + 'cards/mathewson.webp', tint: 'blue' },
  { specId: 1911001n, title: 'T205 Cy Young', set: 'T205 · 1911', short: 'CYYOUNG', category: 'Sports', imageUrl: BASE + 'cards/young.webp', tint: 'mj' },
  { specId: 1909004n, title: 'T206 Walter Johnson', set: 'T206 · 1909', short: 'WJOHN', category: 'Sports', imageUrl: BASE + 'cards/johnson.webp', tint: 'lotus' },
  { specId: 1909005n, title: 'T206 Tris Speaker', set: 'T206 · 1909', short: 'SPEAKER', category: 'Sports', imageUrl: BASE + 'cards/speaker.webp', tint: 'blue' },
  { specId: 1933002n, title: 'Goudey Sport Kings Babe Ruth #2', set: 'Goudey Sport Kings · 1933', short: 'RUTH33', category: 'Sports', imageUrl: BASE + 'cards/ruth.webp', tint: 'mj' },
]
export const categories = ['Pokémon', 'Sports', 'Magic', 'Yu-Gi-Oh!'] as const
/** Category of an on-chain SKU name ("PSA 10 Base Set Charizard Holo"), by catalog title. */
export const catalogOf = (name: string) => catalog.find((c) => name.endsWith(c.title))
export const categoryOf = (name: string) => catalogOf(name)?.category ?? 'Other'

/** Product name, kept in one place so a rename is a one-line change. */
export const brand = 'Tivan'
