// Market maker for Tivan testnet: keeps a resting ask and bid on every card so first-time testers find a price.
// Usage: MAKER_KEY=0x... node scripts/maker.mjs [--once]
// It quotes only with what the maker account already holds (cards and test dollars) and says so in its log.
// NOTE: fixed reference prices and a flat spread, no inventory risk model. Limit: a demo liquidity seed, not a strategy.
import { createPublicClient, createWalletClient, http, parseAbi, encodeAbiParameters, keccak256, formatUnits, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { monadTestnet } from 'viem/chains'

const VAULT = '0x998a3116dc9AaDb98AF27B31BeC93441E1991a12'
const QUOTE = '0x8C43e58dFAcF7Ee589b45EB7d0C61559F7413578' // TestUSD, 6 decimals
const ROUTER = '0x7EFbE105Ca7415dE98F96622173458ac1c054630'
// specId, grade, reference price in dollars (testnet demo values)
const CARDS = [
  [4n, 10, 5000], [4n, 9, 450], [58n, 10, 1500], [2003111n, 10, 17500], [1993232n, 9, 500000],
]
const SPREAD = 0.06 // quote 3% either side of the reference

const key = process.env.MAKER_KEY
if (!key) throw new Error('Set MAKER_KEY to a funded testnet key')
const account = privateKeyToAccount(key)
const pub = createPublicClient({ chain: monadTestnet, transport: http() })
const wal = createWalletClient({ account, chain: monadTestnet, transport: http() })

const vaultAbi = parseAbi(['function skuInfo(bytes32) view returns (address token, address market, uint256 vaulted)'])
const erc20 = parseAbi(['function balanceOf(address) view returns (uint256)', 'function approve(address,uint256) returns (bool)'])
const book = parseAbi(['function bestBidAsk() view returns (uint256,uint256)', 'function addSellOrder(uint32,uint96,bool)', 'function addBuyOrder(uint32,uint96,bool)'])
const margin = parseAbi(['function deposit(address,address,uint256) payable', 'function getBalance(address,address) view returns (uint256)'])
const router = parseAbi(['function marginAccountAddress() view returns (address)'])

const send = async (req) => {
  const { request } = await pub.simulateContract({ account, ...req })
  const h = await wal.writeContract(request)
  const r = await pub.waitForTransactionReceipt({ hash: h })
  if (r.status !== 'success') throw new Error('reverted ' + h)
}
const live = (x) => x > 0n && x < 2n ** 255n

const ma = await pub.readContract({ address: ROUTER, abi: router, functionName: 'marginAccountAddress' })
console.log('maker', account.address)
for (const [spec, grade, ref] of CARDS) {
  const sku = keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'uint8' }], [spec, grade]))
  const [token, market] = await pub.readContract({ address: VAULT, abi: vaultAbi, functionName: 'skuInfo', args: [sku] })
  if (token === '0x0000000000000000000000000000000000000000' || market === '0x0000000000000000000000000000000000000000') { console.log(`#${spec} PSA ${grade}: no market`); continue }
  const [bid, ask] = await pub.readContract({ address: market, abi: book, functionName: 'bestBidAsk' })
  const label = `#${spec} PSA ${grade}`
  if (!live(ask)) {
    const have = (await pub.readContract({ address: token, abi: erc20, functionName: 'balanceOf', args: [account.address] })) + (await pub.readContract({ address: ma, abi: margin, functionName: 'getBalance', args: [account.address, token] }))
    if (have < 1n) console.log(`${label}: no ask, maker holds no card to sell`)
    else {
      const onBook = await pub.readContract({ address: ma, abi: margin, functionName: 'getBalance', args: [account.address, token] })
      if (onBook < 1n) { await send({ address: token, abi: erc20, functionName: 'approve', args: [ma, 1n] }); await send({ address: ma, abi: margin, functionName: 'deposit', args: [account.address, token, 1n] }) }
      const px = Math.round(ref * (1 + SPREAD / 2) * 100)
      await send({ address: market, abi: book, functionName: 'addSellOrder', args: [px, 1n, true] })
      console.log(`${label}: ask $${px / 100}`)
    }
  } else console.log(`${label}: ask exists`)
  if (!live(bid)) {
    const px = Math.round(ref * (1 - SPREAD / 2) * 100)
    const cash = await pub.readContract({ address: QUOTE, abi: erc20, functionName: 'balanceOf', args: [account.address] })
    const need = parseUnits(String(px / 100), 6)
    if (cash < need) console.log(`${label}: no bid, maker cash $${formatUnits(cash, 6)} is short of $${px / 100}`)
    else {
      await send({ address: QUOTE, abi: erc20, functionName: 'approve', args: [ma, need] })
      await send({ address: ma, abi: margin, functionName: 'deposit', args: [account.address, QUOTE, need] })
      await send({ address: market, abi: book, functionName: 'addBuyOrder', args: [px, 1n, true] })
      console.log(`${label}: bid $${px / 100}`)
    }
  } else console.log(`${label}: bid exists`)
}
