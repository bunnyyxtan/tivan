import { defineChain, type Address } from 'viem'
import { fileURLToPath } from 'node:url'

// Secrets (DEPLOYER_KEY, optional PSA_TOKEN) come from the repo-root .env; never logged.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)))
} catch {
  // no .env: rely on the real environment
}

const networks = {
  testnet: {
    chain: defineChain({
      id: 10143,
      name: 'Monad Testnet',
      nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
      rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
    }),
    vault: '0x998a3116dc9AaDb98AF27B31BeC93441E1991a12' as Address,
    quote: '0x8C43e58dFAcF7Ee589b45EB7d0C61559F7413578' as Address, // TestUSD
    kuruRouter: '0x7EFbE105Ca7415dE98F96622173458ac1c054630' as Address,
    drip: true,
  },
  mainnet: {
    chain: defineChain({
      id: 143,
      name: 'Monad',
      nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
      rpcUrls: { default: { http: ['https://rpc.monad.xyz'] } },
    }),
    vault: (process.env.MAINNET_VAULT || '0x5ad7d5e06df36415c6f3fA48299Bf92ed921859a') as Address, // deploy block 110839553
    quote: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603' as Address, // USDC (Kuru MON-USDC is the liquid book; MON-AUSD is empty)
    kuruRouter: '0xd651346d7c789536ebf06dc72aE3C8502cd695CC' as Address,
    drip: false,
  },
} as const

const name = process.env.NETWORK ?? 'testnet'
if (name !== 'testnet' && name !== 'mainnet') throw new Error(`NETWORK must be testnet|mainnet, got ${name}`)
export const network = { name, ...networks[name] }
if (!/^0x[0-9a-fA-F]{40}$/.test(network.vault)) throw new Error(`no SlabVault address for ${name} (set MAINNET_VAULT)`)

const key = process.env.DEPLOYER_KEY
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('DEPLOYER_KEY missing or malformed in .env')
export const deployerKey = key as `0x${string}`
export const psaToken = process.env.PSA_TOKEN || undefined
// Mainnet guard: real cards only. No demo fixtures, and custody needs the custodian's own secret.
if (name === 'mainnet' && !psaToken) throw new Error('mainnet requires PSA_TOKEN (fixtures are testnet only)')
const custody = process.env.CUSTODY_TOKEN || undefined
if (name === 'mainnet' && (!custody || custody.length < 32)) throw new Error('mainnet requires CUSTODY_TOKEN (32+ chars)')
export const custodyToken = custody
export const port = Number(process.env.PORT ?? 8787)
