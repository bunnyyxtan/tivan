// Live check of Tivan's Kuru Spot V2 module on Monad testnet, against Kuru's own MON/USDC market.
// A fresh throwaway key is funded by Tivan's attestor faucet, then: deposit MON into AccountCore, rest a post-only sell far
// above the market, read it back from the book and the maker slots, cancel it, and withdraw.
// Usage (from web/): KEY_FILE=<path outside the repo> node scripts/v2-smoke.mjs
// The key is written to KEY_FILE (and reused if it exists) so a run that stops halfway can be finished and cleaned up.
import { createPublicClient, createWalletClient, formatEther, http, parseEther, zeroAddress } from 'viem'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { monadTestnet } from 'viem/chains'
import { balanceOf, cancelSlots, deposit, openSlots, placeOrders, readBook, readMarket, rootIdOf, withdraw } from '../src/kuru2.ts'

const MON_USDC = '0x26cd68436B6A4AEB3ec52abC20A4d121f8B4BAc9'
const ATTESTOR = process.env.ATTESTOR_URL ?? 'https://tivan-attestor.onrender.com'
const transport = http('https://testnet-rpc.monad.xyz', { retryCount: 6, retryDelay: 400 })
// Reads in one tick go out as one Multicall3 call, which keeps a 32-slot scan under the public RPC's 15 requests a second.
const pub = createPublicClient({ chain: monadTestnet, transport, batch: { multicall: true } })
const keyFile = process.env.KEY_FILE
if (!keyFile) throw new Error('set KEY_FILE to a path outside the repo')
const key = existsSync(keyFile) ? readFileSync(keyFile, 'utf8').trim() : generatePrivateKey()
writeFileSync(keyFile, key)
const account = privateKeyToAccount(key)
const wallet = createWalletClient({ account, chain: monadTestnet, transport })
const step = (s, ...x) => console.log(`- ${s}`, ...x)

step('throwaway wallet', account.address)
if ((await pub.getBalance({ address: account.address })) < parseEther('0.15')) {
  const drip = await fetch(`${ATTESTOR}/drip`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: account.address }) }).then((r) => r.json())
  if (!drip.txHash) throw new Error(`faucet: ${drip.error}`)
  await pub.waitForTransactionReceipt({ hash: drip.txHash })
  step('funded by the faucet', `${drip.amount} MON`, drip.txHash)
}

const m = await readMarket(pub, MON_USDC)
step('market', { base: m.base, quote: m.quote, pricePrecision: m.pricePrecision, sizePrecision: String(m.sizePrecision), minQuote: String(m.minQuote) })

const amount = parseEther('0.1')
let r = await deposit(pub, wallet, zeroAddress, amount)
const root = await rootIdOf(pub, account.address)
step('deposited 0.1 MON, root account', String(root), r.transactionHash)
step('balance after deposit', await balanceOf(pub, root, zeroAddress).then((b) => ({ free: formatEther(b.free), reserved: formatEther(b.reserved) })))

r = await placeOrders(pub, wallet, m, root, [{ side: 'sell', price: '100', size: '0.1', postOnly: true }])
step('rested a post-only sell of 0.1 MON at $100', r.transactionHash)
const slots = await openSlots(pub, m, root)
const book = await readBook(pub, m, 5)
step('maker slots', slots.map((s) => ({ slot: s.slot, orderId: String(s.orderId) })))
step('book asks', book.asks)
step('balance with the order resting', await balanceOf(pub, root, zeroAddress).then((b) => ({ free: formatEther(b.free), reserved: formatEther(b.reserved) })))
if (!slots.length || !book.asks.some((a) => a.price === 100)) throw new Error('order is not on the book')

r = await cancelSlots(pub, wallet, m, root, slots.map((s) => s.slot))
step('cancelled', r.transactionHash, 'slots now', (await openSlots(pub, m, root)).length)
const after = await balanceOf(pub, root, zeroAddress)
step('balance after cancel', { free: formatEther(after.free), reserved: formatEther(after.reserved) })

r = await withdraw(pub, wallet, root, zeroAddress, after.free)
step('withdrew', formatEther(after.free), 'MON', r.transactionHash)
step('wallet MON now', formatEther(await pub.getBalance({ address: account.address })))
console.log('ok: deposit, post-only order, book read, slot read, cancel and withdraw all work on Kuru Spot V2')
