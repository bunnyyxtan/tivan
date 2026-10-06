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
    seedSkus: [
      { specId: 4n, grade: 10 },
      { specId: 4n, grade: 9 },
      { specId: 58n, grade: 10 },
      { specId: 2003111n, grade: 10 },
      { specId: 1993232n, grade: 9 },
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
    // DEMO SKUs: tokens named "DEMO …", no physical cards. Kuru mainnet markets are owner-gated, so pending listing.
    seedSkus: [
      { specId: 58n, grade: 10 },
      { specId: 4n, grade: 10 },
      { specId: 2003111n, grade: 10 },
      { specId: 1993232n, grade: 9 },
    ],
  },
}

const which = (import.meta.env.VITE_NETWORK ?? 'testnet') as Network['name']
if (!(which in networks)) throw new Error(`VITE_NETWORK must be testnet or mainnet, got ${which}`)
export const net = networks[which]

export const attestorUrl: string = import.meta.env.VITE_ATTESTOR_URL ?? 'http://localhost:8787'
/** Envio HyperIndex GraphQL (indexer/). Optional: without it the app reads SKUs and trades straight from the RPC. */
export const indexerUrl: string | undefined = import.meta.env.VITE_INDEXER_URL || undefined

/** Cards the demo grader registry knows (cre/fixtures/psa-certs.json). Shown as presets in "Vault a card". */
const BASE = import.meta.env.BASE_URL // '/' in dev, '/<repo>/' on GitHub Pages
export const catalog = [
  { specId: 4n, title: 'Base Set Charizard Holo', set: 'Pokémon · 1999', short: 'CHZ', category: 'Pokémon', img: BASE + 'cards/charizard.webp', tint: 'char' },
  { specId: 58n, title: 'Base Set Pikachu Red Cheeks', set: 'Pokémon · 1999', short: 'PIKA', category: 'Pokémon', img: BASE + 'cards/pikachu.webp', tint: 'pika' },
  { specId: 2003111n, title: 'Topps Chrome LeBron James Rookie #111', set: 'Basketball · 2003', short: 'LBJ03', category: 'Sports', img: '', tint: 'lbj' },
  { specId: 1986057n, title: 'Fleer Michael Jordan #57', set: 'Basketball · 1986', short: 'MJ86', category: 'Sports', img: '', tint: 'mj' },
  { specId: 1993232n, title: 'Alpha Black Lotus', set: 'Magic: The Gathering · 1993', short: 'LOTUS', category: 'Magic', img: BASE + 'cards/lotus.webp', tint: 'lotus' },
]
export const categories = ['Pokémon', 'Sports', 'Magic'] as const
/** Category of an on-chain SKU name ("PSA 10 Base Set Charizard Holo"), by catalog title. */
export const catalogOf = (name: string) => catalog.find((c) => name.endsWith(c.title))
export const categoryOf = (name: string) => catalogOf(name)?.category ?? 'Other'

/** Product name, kept in one place so a rename is a one-line change. */
export const brand = 'Tivan'
