// Market maker for Tivan testnet: keeps a resting ask and bid on every card so first-time testers find a price.
// Usage: cd scripts && MAKER_KEY=0x... node maker.mjs [--once]
// Without --once it re-checks every 20 s and refills whatever traders have taken, so first-time testers always find a price.
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
  [4n, 10, 5000, 'Base Set Charizard Holo', 'CHZ'], [4n, 9, 450, 'Base Set Charizard Holo', 'CHZ'], [58n, 10, 1500, 'Base Set Pikachu Red Cheeks', 'PIKA'],
  [2003111n, 10, 17500, 'Topps Chrome LeBron James Rookie #111', 'LBJ03'], [1993232n, 9, 500000, 'Alpha Black Lotus', 'LOTUS'],
  [2n, 9, 1850, 'Base Set Blastoise Holo', 'BLST'],
  [15n, 9, 1300, 'Base Set Venusaur Holo', 'VENU'],
  [10n, 9, 450, 'Base Set Mewtwo Holo', 'MEW2'],
  [1986057n, 8, 9000, 'Fleer Michael Jordan #57', 'MJ86'],
  [1996138n, 10, 14000, 'Topps Chrome Kobe Bryant Rookie #138', 'KOBE96'],
  [1952311n, 5, 95000, 'Topps Mickey Mantle #311', 'MANTLE'],
  [2000144n, 9, 22000, 'Contenders Tom Brady Autograph #144', 'BRADY'],
  [1979018n, 8, 18000, 'O-Pee-Chee Wayne Gretzky Rookie #18', 'GRETZ'],
  [2018700n, 10, 2500, 'Topps Update Shohei Ohtani Rookie #US1', 'OHTANI'],
  [1993140n, 8, 38000, 'Alpha Mox Sapphire', 'MOXS'],
  [1993180n, 9, 4500, 'Alpha Underground Sea', 'USEA'],
  [2002001n, 9, 4200, 'Legend of Blue Eyes Blue-Eyes White Dragon', 'BEWD'],
  [2002005n, 9, 1100, 'Legend of Blue Eyes Dark Magician', 'DKMG'],
  [2002124n, 9, 600, 'Legend of Blue Eyes Exodia the Forbidden One', 'EXOD'],
]
// When a card sells out the maker has nothing to list, so it vaults a fresh demo copy through the attestor (testnet demo
// certs 9xxxxxxx, see attestor/src/psa.ts). Capped per hour so a buying spree cannot burn the faucet account's gas.
const ATTESTOR = process.env.ATTESTOR_URL ?? `http://localhost:${process.env.PORT ?? 8787}`
const RESTOCKS_PER_HOUR = 20
const restocked = []
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
let quiet = false
const seen = new Set()
const say = (m) => (/exists$|: no /.test(m) && quiet && seen.has(m) ? undefined : (seen.add(m), console.log(m)))
async function restock(idx, spec, grade, title, short, label) {
  const now = Date.now()
  while (restocked.length && now - restocked[0] > 3600_000) restocked.shift()
  if (restocked.length >= RESTOCKS_PER_HOUR) return false
  const post = async (path, body) => {
    const r = await fetch(ATTESTOR + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: r.ok, text: await r.text() }
  }
  for (let i = 0; i < 5; i++) {
    const certId = String(90_000_000 + idx * 10_000 + Math.floor(Math.random() * 10_000))
    const a = await post('/attest', { certId, specId: String(spec), grade, holder: account.address, name: `PSA ${grade} ${title}`, symbol: `PSA${grade}-${short}` })
    if (!a.ok && /cert known/.test(a.text)) continue
    if (!a.ok) return void say(`${label}: restock failed (${a.text.slice(0, 100)})`)
    const c = await post('/custody', { certId })
    if (!c.ok) return void say(`${label}: restock custody failed (${c.text.slice(0, 100)})`)
    restocked.push(now)
    say(`${label}: restocked with demo cert ${certId}`)
    return true
  }
  return false
}

async function pass() {
  for (const [idx, [spec, grade, ref, title, short]] of CARDS.entries()) {
    const sku = keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'uint8' }], [spec, grade]))
    let [token, market] = await pub.readContract({ address: VAULT, abi: vaultAbi, functionName: 'skuInfo', args: [sku] })
    // A card nobody has vaulted yet has no token or market: vaulting its first copy creates both.
    if (token === '0x0000000000000000000000000000000000000000') {
      if (await restock(idx, spec, grade, title, short, `#${spec} PSA ${grade}`)) [token, market] = await pub.readContract({ address: VAULT, abi: vaultAbi, functionName: 'skuInfo', args: [sku] })
    }
    if (token === '0x0000000000000000000000000000000000000000' || market === '0x0000000000000000000000000000000000000000') { say(`#${spec} PSA ${grade}: no market`); continue }
    const [bid, ask] = await pub.readContract({ address: market, abi: book, functionName: 'bestBidAsk' })
    const label = `#${spec} PSA ${grade}`
    if (!live(ask)) {
      const held = async () => (await pub.readContract({ address: token, abi: erc20, functionName: 'balanceOf', args: [account.address] })) + (await pub.readContract({ address: ma, abi: margin, functionName: 'getBalance', args: [account.address, token] }))
      let have = await held()
      if (have < 1n && (await restock(idx, spec, grade, title, short, label))) have = await held()
      if (have < 1n) say(`${label}: no ask, maker holds no card to sell`)
      else {
        const onBook = await pub.readContract({ address: ma, abi: margin, functionName: 'getBalance', args: [account.address, token] })
        if (onBook < 1n) { await send({ address: token, abi: erc20, functionName: 'approve', args: [ma, 1n] }); await send({ address: ma, abi: margin, functionName: 'deposit', args: [account.address, token, 1n] }) }
        const px = Math.round(ref * (1 + SPREAD / 2) * 100)
        await send({ address: market, abi: book, functionName: 'addSellOrder', args: [px, 1n, true] })
        say(`${label}: ask $${px / 100}`)
      }
    } else say(`${label}: ask exists`)
    if (!live(bid)) {
      const px = Math.round(ref * (1 - SPREAD / 2) * 100)
      const need = parseUnits(String(px / 100), 6)
      const [wallet, onBook] = await Promise.all([
        pub.readContract({ address: QUOTE, abi: erc20, functionName: 'balanceOf', args: [account.address] }),
        pub.readContract({ address: ma, abi: margin, functionName: 'getBalance', args: [account.address, QUOTE] }),
      ])
      // Cash already on the exchange backs the bid directly; only top up from the wallet when it falls short.
      if (wallet + onBook < need) say(`${label}: no bid, maker cash $${formatUnits(wallet + onBook, 6)} is short of $${px / 100}`)
      else {
        if (onBook < need) { await send({ address: QUOTE, abi: erc20, functionName: 'approve', args: [ma, need - onBook] }); await send({ address: ma, abi: margin, functionName: 'deposit', args: [account.address, QUOTE, need - onBook] }) }
        await send({ address: market, abi: book, functionName: 'addBuyOrder', args: [px, 1n, true] })
        say(`${label}: bid $${px / 100}`)
      }
    } else say(`${label}: bid exists`)
  }
}

const once = process.argv.includes('--once')
await pass().catch((e) => (once ? Promise.reject(e) : console.warn('first pass failed, retrying:', String(e.shortMessage ?? e.message ?? e).slice(0, 140))))
quiet = true
while (!once) {
  await new Promise((r) => setTimeout(r, 20000))
  await pass().catch((e) => console.warn('pass failed, retrying:', String(e.shortMessage ?? e.message ?? e).slice(0, 140)))
}
