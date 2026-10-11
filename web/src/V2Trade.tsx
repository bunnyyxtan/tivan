import { useState } from 'react'
import { erc20Abi, formatUnits, zeroAddress, type Address, type LocalAccount } from 'viem'
import { explorerTx, fast, pub, walletFor } from './chain'
import { ensureGas, post } from './attestor'
import { Button } from './controls'
import { usePoll } from './ui'
import { V2, balanceOf, bookQty, cancelSlots, deposit, openSlots, placeOrders, readBook, readMarket, rootIdOf, swap, withdraw, type V2Market } from './kuru2'

// The card's book on Kuru Spot V2, beside its original book. V2 keeps cash and cards inside Kuru's AccountCore, so this
// panel shows both the wallet and the Kuru balance and tops the Kuru balance up from the wallet when an order needs it.
// It is generic over the market, so the same code trades any V2 pair; card markets use whole cards priced in cents.

const markets = new Map<string, Promise<V2Market>>()
const marketOf = (a: Address) => markets.get(a) ?? (markets.set(a, readMarket(pub, a)), markets.get(a)!)
const quoteDecimals = new Map<string, Promise<number>>()
const decimalsOf = (t: Address) => quoteDecimals.get(t) ?? (quoteDecimals.set(t, pub.readContract({ address: t, abi: erc20Abi, functionName: 'decimals' })), quoteDecimals.get(t)!)
const walletBalance = (token: Address, owner: Address) => (token === zeroAddress ? pub.getBalance({ address: owner }) : pub.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [owner] }))

// Kuru's revert names, said plainly. Anything else falls back to viem's short message.
const PLAIN: Record<string, string> = {
  PriceError: 'Kuru rejected that price. It is outside the range this market accepts right now.',
  PostOnlyError: 'That price would trade straight away, and offers and listings only rest on the book.',
  TickSizeError: 'That price is not on this market’s price steps.',
  SizeError: 'That quantity is outside what this market accepts.',
}
function plain(e: unknown) {
  const name = (e as { cause?: { data?: { errorName?: string } } })?.cause?.data?.errorName
  if (name && PLAIN[name]) return PLAIN[name]
  if (name) return `Kuru refused the order (${name}).`
  return e instanceof Error ? ((e as { shortMessage?: string }).shortMessage ?? e.message) : String(e)
}

type View = {
  m: V2Market
  qd: number
  book: Awaited<ReturnType<typeof readBook>>
  root: bigint
  orders: number
  quote: { wallet: bigint; free: bigint; reserved: bigint }
  base: { wallet: bigint; free: bigint; reserved: bigint }
}

async function load(market: Address, me?: Address): Promise<View> {
  const m = await marketOf(market)
  const [qd, book, root] = await Promise.all([decimalsOf(m.quote), readBook(pub, m, 6), me ? rootIdOf(pub, me) : Promise.resolve(0n)])
  const zero = { wallet: 0n, free: 0n, reserved: 0n }
  if (!me) return { m, qd, book, root, orders: 0, quote: zero, base: zero }
  const [qw, bw, qa, ba, slots] = await Promise.all([walletBalance(m.quote, me), walletBalance(m.base, me), balanceOf(pub, root, m.quote), balanceOf(pub, root, m.base), openSlots(pub, m, root)])
  return { m, qd, book, root, orders: slots.length, quote: { wallet: qw, ...qa }, base: { wallet: bw, ...ba } }
}

export function V2Trade({ market, account, unit }: { market: Address; account?: LocalAccount; unit: string }) {
  const me = account?.address
  const { data: v, error, refresh } = usePoll(() => load(market, me), 5000, [market, me])
  const [qty, setQty] = useState('1')
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState<string>()
  const [msg, setMsg] = useState<{ ok: boolean; text: string; hash?: string }>()

  if (error && !v) return <p className="fine">Couldn’t read the Kuru V2 book. {error}</p>
  if (!v) return <p className="fine">Reading the Kuru V2 book…</p>
  const { m, qd, book } = v
  const baseAtomsPerUnit = m.mult * m.sizePrecision
  const units = (atoms: bigint) => Number(formatUnits(atoms, 0)) / Number(baseAtomsPerUnit)
  const usd = (atoms: bigint) => `$${Number(formatUnits(atoms, qd)).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  const quoteAtoms = (dollars: number) => BigInt(Math.ceil(dollars * 10 ** qd))
  const bestAsk = book.asks[0]?.price
  const bestBid = book.bids[0]?.price

  // Gas is checked in steps of about 0.02 MON. V2 deposits and withdrawals run Kuru's limiter and price checks and use
  // about 0.05 MON each on testnet (494k gas measured for a withdraw), so V2 actions ask for more steps than V1 ones.
  async function run(label: string, steps: number, fn: (w: ReturnType<typeof walletFor>) => Promise<{ transactionHash: string }>) {
    if (!account) return
    setBusy(label)
    setMsg(undefined)
    try {
      if (!(await ensureGas(account.address, steps))) throw new Error('Your account needs a little MON for network fees. The faucet tops it up again within two minutes.')
      const r = await fn(walletFor(account))
      setMsg({ ok: true, text: `${label} done.`, hash: r.transactionHash })
    } catch (e) {
      setMsg({ ok: false, text: plain(e) })
    } finally {
      setBusy(undefined)
      refresh()
    }
  }
  // Orders and swaps spend the Kuru balance, so top it up from the wallet first when it is short.
  const topUp = async (w: ReturnType<typeof walletFor>, token: Address, need: bigint, free: bigint, inWallet: bigint) => {
    if (free >= need) return
    if (free + inWallet < need) throw new Error('Not enough in your wallet and Kuru balance together.')
    await deposit(fast, w, token, need - free)
  }
  const n = Number(qty) || 0
  const p = Number(price) || 0

  return (
    <div className="v2">
      <div className="v2-book" aria-label="Kuru V2 order book">
        <div className="v2-row v2-head"><span>Price</span><span>{unit}</span></div>
        {[...book.asks.slice(0, 5)].reverse().map((l) => <div key={`a${l.price}`} className="v2-row ask"><span>${l.price.toLocaleString('en-US')}</span><span>{l.size}</span></div>)}
        <div className="v2-mid">{bestAsk && bestBid ? `Spread $${(bestAsk - bestBid).toLocaleString('en-US', { maximumFractionDigits: 2 })}` : book.asks.length || book.bids.length ? 'One side is empty' : 'No orders yet'}</div>
        {book.bids.slice(0, 5).map((l) => <div key={`b${l.price}`} className="v2-row bid"><span>${l.price.toLocaleString('en-US')}</span><span>{l.size}</span></div>)}
      </div>

      <div className="v2-side">
        {!account ? (
          <p className="fine">Sign in to trade on Kuru V2.</p>
        ) : (
          <>
            <dl className="v2-bal">
              <div><dt>Cash in Kuru</dt><dd>{usd(v.quote.free)}{v.quote.reserved ? <small> + {usd(v.quote.reserved)} in offers</small> : null}</dd></div>
              <div><dt>Cash in wallet</dt><dd>{usd(v.quote.wallet)}</dd></div>
              <div><dt>{unit} in Kuru</dt><dd>{units(v.base.free)}{v.base.reserved ? <small> + {units(v.base.reserved)} listed</small> : null}</dd></div>
              <div><dt>{unit} in wallet</dt><dd>{units(v.base.wallet)}</dd></div>
            </dl>
            <div className="v2-inputs">
              <label><span>Quantity</span><input className="num-in" aria-label="Quantity" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.]/g, ''))} /></label>
              <label><span>Price for offers and listings</span><input className="num-in" aria-label="Price for offers and listings" inputMode="decimal" placeholder={bestBid ? String(bestBid) : '0.00'} value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} /></label>
            </div>
            <div className="v2-actions">
              <Button size={40} pending={busy === 'Buy'} disabled={!!busy || !bestAsk || !n} onClick={() => run('Buy', 5, async (w) => {
                // Exact input with a 1% price cushion; the min-out guard makes it all or nothing at the quantity asked.
                const spend = quoteAtoms(bestAsk! * n * 1.01)
                await topUp(w, m.quote, spend, v.quote.free, v.quote.wallet)
                return swap(fast, w, m, await rootIdOf(fast, w.account.address), true, spend, bookQty(m, qty) * m.mult)
              })}>Buy now</Button>
              <Button size={40} variant="secondary" pending={busy === 'Sell'} disabled={!!busy || !bestBid || !n} onClick={() => run('Sell', 5, async (w) => {
                const atoms = bookQty(m, qty) * m.mult
                await topUp(w, m.base, atoms, v.base.free, v.base.wallet)
                return swap(fast, w, m, await rootIdOf(fast, w.account.address), false, atoms, quoteAtoms(bestBid! * n * 0.99) - 1n)
              })}>Sell now</Button>
              <Button size={40} variant="secondary" pending={busy === 'Offer'} disabled={!!busy || !p || !n} onClick={() => run('Offer', 5, async (w) => {
                await topUp(w, m.quote, quoteAtoms(p * n), v.quote.free, v.quote.wallet)
                return placeOrders(fast, w, m, await rootIdOf(fast, w.account.address), [{ side: 'buy', price, size: qty, postOnly: true }])
              })}>Make an offer</Button>
              <Button size={40} variant="secondary" pending={busy === 'Listing'} disabled={!!busy || !p || !n} onClick={() => run('Listing', 5, async (w) => {
                await topUp(w, m.base, bookQty(m, qty) * m.mult, v.base.free, v.base.wallet)
                return placeOrders(fast, w, m, await rootIdOf(fast, w.account.address), [{ side: 'sell', price, size: qty, postOnly: true }])
              })}>List</Button>
            </div>
            <div className="v2-actions quiet">
              {v.orders > 0 && <Button size={32} variant="tertiary" pending={busy === 'Cancel'} disabled={!!busy} onClick={() => run('Cancel', 1, async (w) => cancelSlots(fast, w, m, v.root, (await openSlots(fast, m, v.root)).map((o) => o.slot)))}>Cancel {v.orders} order{v.orders > 1 ? 's' : ''}</Button>}
              {(v.quote.free > 0n || v.base.free > 0n) && (
                <Button size={32} variant="tertiary" pending={busy === 'Withdraw'} disabled={!!busy} onClick={() => run('Withdraw', 6, async (w) => {
                  let last: { transactionHash: string } | undefined
                  if (v.quote.free > 0n) last = await withdraw(fast, w, v.root, m.quote, v.quote.free)
                  if (v.base.free > 0n) last = await withdraw(fast, w, v.root, m.base, v.base.free)
                  return last!
                })}>Move all to wallet</Button>
              )}
              {m.quote === V2.usdc && v.quote.wallet + v.quote.free === 0n && (
                <Button size={32} variant="tertiary" pending={busy === 'USDC'} disabled={!!busy} onClick={async () => {
                  setBusy('USDC')
                  setMsg(undefined)
                  try {
                    const r = await post('/v2/usdc', { address: me })
                    setMsg({ ok: true, text: 'Kuru test USDC is on its way.', hash: r.txHash })
                  } catch (e) {
                    setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
                  } finally {
                    setBusy(undefined)
                    refresh()
                  }
                }}>Get Kuru test USDC</Button>
              )}
            </div>
            {msg && (
              <p className={`fine ${msg.ok ? '' : 'neg'}`} role="status">
                {msg.text} {msg.hash && <a className="u" href={explorerTx(msg.hash)} target="_blank" rel="noreferrer">View the transaction</a>}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
