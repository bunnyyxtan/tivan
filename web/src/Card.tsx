import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Acct } from './App'
import { alertPrice, useAlerts } from './alerts'
import { Define, Updated, ago, cents, recordViewed, useNow, usdC } from './cardParts'
import { Breadcrumbs } from './desk'
import { cancelOrder, buyNow, listAsk, makeOffer, sellNow, type Built, type Ctx, type Funds } from './flows'
import { Button, Copyable, Seg } from './controls'
import { catalogOf, net } from './config'
import { explorerAddress, hasMarket, loadSkus, marketRules, readBook, tradeHistory, type Fill, type Sku } from './chain'
import { gql } from './chain'
import { aggregate, averageBuyUnits, spread, unrealisedPnl, walkAsks, walkBids, type Level } from './logic/orders.ts'
import { centsToUnits, formatBps, formatQty, formatUsd } from './logic/money.ts'
import { usePortfolio } from './portfolio'
import { ErrorNote, Skeleton } from './States'
import { useTx } from './tx'
import { cardSub, cardTitle, parseName, usePoll, useWatch } from './ui'
import { Viewer, gradeOf } from './Market'
import { IconActivity, IconCheck, IconShare, IconStar, IconVault } from './icons'
import { MarketTile } from './kit'

const PriceChart = lazy(() => import('./PriceChart'))
const Inspector = lazy(() => import('./Inspector'))
const usdU = (u: bigint, d: 'auto' | 2 = 'auto') => formatUsd(u, { digits: d })
const when = (t: number) => new Date(t * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Everything one market page reads: the SKU and its grades, the exact book, the rules, and the trades. Each part refreshes on its own. */
export function useMarket(sku: string) {
  const m = usePoll(
    async () => {
      const all = await loadSkus()
      const s = all.find((x) => x.sku === sku)
      if (!s) throw new Error('Card not found')
      const live = hasMarket(s)
      const [book, rules] = await Promise.all([live ? readBook(s.market) : { bids: [], asks: [] }, live ? marketRules(s.market) : undefined])
      return { all, s, book, rules, at: Date.now() }
    },
    4000,
    [sku],
  )
  const h = usePoll(async () => (m.data && hasMarket(m.data.s) ? tradeHistory(m.data.s.market) : undefined), 15000, [m.data?.s.market])
  return { m, h }
}

type CertRow = { id: string; status: string; updatedAt: number }
/** The slabs backing a market, from the indexer when it is connected. */
function useCerts(sku: string) {
  return usePoll(
    async (): Promise<CertRow[] | undefined> => {
      try {
        const { Cert } = await gql<{ Cert: CertRow[] }>('query($s: String!) { Cert(where: { sku: { _eq: $s } }, order_by: { updatedAt: desc }) { id status updatedAt } }', { s: sku })
        return Cert
      } catch {
        return undefined
      }
    },
    60000,
    [sku],
  )
}

const SECTIONS = [
  ['history', 'Price history'],
  ['book', 'Order book'],
  ['trades', 'Trades'],
  ['about', 'About'],
  ['grades', 'All grades'],
  ['vault', 'Vault and verification'],
  ['position', 'Your position'],
] as const

export function CardPage({ sku, account }: { sku: string; account: Acct }) {
  const { m, h } = useMarket(sku)
  const me = account?.address
  const port = usePortfolio(me, true)
  const certs = useCerts(sku)
  const watch = useWatch()
  const tx = useTx()
  const now = useNow()
  const [mode, setMode] = useState<'buy' | 'offer' | 'sell' | undefined>()
  const [prefill, setPrefill] = useState<{ price?: string; qty?: string; sellMode?: 'now' | 'list' }>({})
  const [undo, setUndo] = useState<string>()
  const [shared, setShared] = useState<string>()
  const [inspect, setInspect] = useState(false)
  useEffect(() => recordViewed(sku), [sku])
  // Back from signing in: the same card, the same order form, the same prefilled numbers.
  useEffect(() => {
    if (!account) return
    const o = sessionStorage.getItem('tivan.order')
    if (!o) return
    sessionStorage.removeItem('tivan.order')
    try {
      const j = JSON.parse(o)
      if (j.sku === sku) (setMode(j.mode), setPrefill(j.prefill ?? {}))
    } catch {}
  }, [account, sku])
  const signInHere = () => {
    try {
      sessionStorage.setItem('tivan.returnTo', JSON.stringify({ hash: location.hash }))
      if (mode) sessionStorage.setItem('tivan.order', JSON.stringify({ sku, mode, prefill }))
    } catch {}
    location.hash = '#/you'
  }
  const [barOn, setBarOn] = useState(false)
  const actions = useRef<HTMLDivElement>(null)

  const d = m.data
  // The phone's bottom bar appears once the main actions have scrolled out of view.
  useEffect(() => {
    const el = actions.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setBarOn(!e.isIntersecting && e.boundingClientRect.top < 0))
    io.observe(el)
    return () => io.disconnect()
  }, [d?.s.sku])

  if (!d)
    return (
      <>
        <Breadcrumbs items={[['Markets', '#/'], ['Card']]} />
        {m.error ? <ErrorNote what="Couldn’t load this card." why={m.error} next="Check your connection, then try again." onRetry={m.refresh} /> : <div className="cx" aria-hidden><div className="cx-media"><div className="card-hero"><Skeleton h={460} w={320} r={14} /></div></div><div className="cx-trade"><Skeleton h={14} w="30%" r={4} /><Skeleton h={40} w="80%" r={6} /><Skeleton h={64} r={10} /><Skeleton h={240} r={16} /></div></div>}
      </>
    )

  const { s, book, rules, all } = d
  const live = hasMarket(s)
  const c = catalogOf(s.name)
  const title = cardTitle(s.name)
  const label = `${title}, ${parseName(s.name).grader} ${parseName(s.name).grade}`
  const { demo } = parseName(s.name)
  const asksAgg = aggregate(book.asks, 'ask')
  const bidsAgg = aggregate(book.bids, 'bid')
  const askC = asksAgg[0]?.price
  const bidC = bidsAgg[0]?.price
  const fills: Fill[] = h.data?.fills ?? []
  const trades = fills.map((f) => ({ t: f.t, price: cents(f.price), size: BigInt(f.size), hash: f.hash }))
  const lastTrade = trades.at(-1)
  const sibs = all.filter((x) => catalogOf(x.name)?.title === c?.title).sort((a, b) => gradeOf(b) - gradeOf(a))
  const hold = port.data?.holdings.find((x) => x.s.sku === sku)
  const funds: Funds | undefined = port.data && { ma: port.data.ma, cashRaw: port.data.cashRaw, exCashRaw: port.data.exCashRaw, wallet: hold?.wallet ?? 0n, onBook: hold?.onBook ?? 0n, gas: port.data.gas }
  const available = funds ? funds.cashRaw + funds.exCashRaw : undefined
  const mine = (port.orders?.[sku] ?? []).map((o) => ({ id: o.id, priceCents: cents(o.price), size: BigInt(o.size), isBuy: o.isBuy }))
  const held = (hold?.wallet ?? 0n) + (hold?.onBook ?? 0n)
  const listed = mine.filter((o) => !o.isBuy).reduce((n, o) => n + o.size, 0n)
  const owned = held + listed
  const reconcile = async () => {
    await Promise.all([m.refresh(), h.refresh(), port.refresh()])
    await new Promise((r) => setTimeout(r, 700))
  }
  const ctx: Ctx | undefined = account && funds && rules && live ? { account, s, label, rules, funds, reconcile } : undefined
  const avg = me ? averageBuyUnits(fills.map((f) => ({ price: cents(f.price), size: BigInt(f.size), mine: f.taker === me.toLowerCase() ? (f.takerBuy ? ('buy' as const) : ('sell' as const)) : f.maker === me.toLowerCase() ? (f.takerBuy ? ('sell' as const) : ('buy' as const)) : undefined }))) : undefined
  const spreadInfo = spread(askC, bidC)
  const watching = watch.list.includes(sku)
  const pick = (side: 'ask' | 'bid', lvl: { price: bigint; cumulative: bigint }) => {
    if (side === 'ask') (setMode('buy'), setPrefill({ qty: String(lvl.cumulative) }))
    else owned > 0n ? (setMode('sell'), setPrefill({ sellMode: 'now', qty: String(lvl.cumulative < owned ? lvl.cumulative : owned) })) : (setMode('offer'), setPrefill({ price: (Number(lvl.price) / 100).toString() }))
    requestAnimationFrame(() => document.getElementById('order-form')?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  const share = async () => {
    const url = location.href
    try {
      if (navigator.share) await navigator.share({ title: `${title} on Tivan`, url })
      else (await navigator.clipboard.writeText(url), setShared('Link copied.'))
    } catch {
      setShared('Sharing was cancelled or blocked. Copy the address from your browser.')
    }
  }
  const toggleWatch = () => {
    const on = watch.toggle(sku)
    setUndo(on ? 'Added to your watchlist.' : 'Removed from your watchlist.')
  }
  const lastC = lastTrade ? lastTrade.price : s.last ? cents(s.last) : undefined
  const buttons = live && (
    <div className="buy-actions" ref={actions}>
      {askC !== undefined ? (
        <Button size={48} onClick={() => {
          // One card at the ask goes straight to review; anything that needs a choice opens the form.
          const b = ctx ? buyNow(ctx, book.asks, 1n) : undefined
          if (b?.spec) tx.open(b.spec)
          else (setMode('buy'), setPrefill({}))
        }}>Buy now · {usdC(askC)}</Button>
      ) : (
        <Button size={48} onClick={() => (setMode('offer'), setPrefill({}))}>Make an offer</Button>
      )}
      {askC !== undefined && <Button variant="secondary" size={48} onClick={() => (setMode('offer'), setPrefill({}))}>Make an offer</Button>}
      {owned > 0n && <Button variant="secondary" size={48} onClick={() => (setMode('sell'), setPrefill({}))}>Sell yours</Button>}
    </div>
  )

  return (
    <>
      <Breadcrumbs items={[['Markets', '#/'], ...(c ? ([[c.category, `#/browse?cat=${encodeURIComponent(c.category)}`]] as [string, string][]) : [['Browse', '#/browse']] as [string, string][]), [title]]} />
      <div className="cx">
        <div className="cx-media">
          <div className="card-hero">
            <Viewer s={s} onInspect={() => setInspect(true)} />
            {inspect && <Suspense fallback={null}><Inspector name={s.name} sibs={sibs.map((x) => ({ name: x.name, sku: x.sku }))} onClose={() => setInspect(false)} /></Suspense>}
          </div>
        </div>
        <aside className="cx-trade" aria-label="Trade">
          <header className="cx-head">
            <div className="cx-title">
              <p className="eyebrow">{c?.category ?? 'Graded card'} · {parseName(s.name).grader} {parseName(s.name).grade}</p>
              <h1 className="card-title">{title}</h1>
              <p className="card-sub">
                {demo ? 'Demo listing · ' : ''}
                {c ? c.set : cardSub(s.name)}
              </p>
            </div>
            <div className="cx-icons">
              <button className={`icon-btn ${watching ? 'on' : ''}`} aria-pressed={watching} aria-label={watching ? 'Watching. Stop watching' : 'Watch this market'} title={watching ? 'Watching' : 'Watch'} onClick={toggleWatch}><IconStar /></button>
              <button className="icon-btn" aria-label="Share" title="Share" onClick={share}><IconShare /></button>
            </div>
          </header>
          {sibs.length > 1 && (
            <div className="grade-pick">
              <span className="lbl-caps">Grade</span>
              <nav className="grades" aria-label="Grades of this card">
                {sibs.map((x) => (
                  <a key={x.sku} href={`#/card/${x.sku}`} aria-current={x.sku === sku ? 'page' : undefined}>
                    <b>{parseName(x.name).grade}</b>
                    <small>{x.ask ? usdC(cents(x.ask)) : 'No ask'}</small>
                  </a>
                ))}
              </nav>
            </div>
          )}
          {!live ? (
            <div className="buybox">
              <b>This market opens soon</b>
              <p className="fine">
                The token is live on {net.chain.name}, but its order book is not listed yet, so buying, selling and offers open once it is.
                {demo ? ' Demo listing: no physical card backs this token.' : ''}
              </p>
            </div>
          ) : (
            <div className="buybox">
              <div className="quote2">
                <div>
                  <span className="lbl-caps">Lowest ask <Define term="ask">The lowest price anyone is asking for one card at this grade right now. Buy now pays this price.</Define></span>
                  <b className="quote2-v">{askC !== undefined ? usdC(askC) : '—'}</b>
                  <small>{askC !== undefined ? `${formatQty(asksAgg[0].size)} for sale at this price` : 'No one is selling at this grade'}</small>
                </div>
                <div>
                  <span className="lbl-caps">Best offer <Define term="best offer">The highest price anyone is bidding for one card at this grade. Selling now receives this price.</Define></span>
                  <b className="quote2-v sm">{bidC !== undefined ? usdC(bidC) : '—'}</b>
                  <small>{bidC !== undefined ? `${formatQty(bidsAgg[0].size)} wanted` : 'No offers yet'}</small>
                </div>
              </div>
              {buttons}
              {owned > 0n && bidC !== undefined && (
                <p className="fine sell-line">
                  You hold {formatQty(owned)}. <button className="linkbtn" onClick={() => { const b = ctx ? sellNow(ctx, book.bids, 1n) : undefined; if (b?.spec) tx.open(b.spec); else (setMode('sell'), setPrefill({ sellMode: 'now' })) }}>Sell one now for {usdC(bidC)}</button> or <button className="linkbtn" onClick={() => (setMode('sell'), setPrefill({ sellMode: 'list' }))}>list it higher</button>.
                </p>
              )}
              <p className="fine ctx" role="status">
                {!account ? <><button className="linkbtn" onClick={signInHere}>Sign in to trade</button> Browsing needs no account.</> : available === undefined ? 'Checking your cash' : <>You have {usdU(available, 2)} available.{askC !== undefined && centsToUnits(askC) > available ? <> <button className="linkbtn" onClick={() => dispatchEvent(new Event('tivan-cash'))}>Add cash</button></> : null}</>}
                {undo && <> {undo} <button className="linkbtn" onClick={() => (watch.toggle(sku), setUndo(undefined))}>Undo</button></>}
                {shared && <> {shared}</>}
              </p>
              {mode && account && ctx && (
                <OrderForm key={`${mode}-${JSON.stringify(prefill)}`} mode={mode} ctx={ctx} asks={book.asks} bids={book.bids} askC={askC} bidC={bidC} owned={owned} prefill={prefill} onClose={() => setMode(undefined)} />
              )}
              {mode && !account && <p className="notice">Sign in first. Your passkey is your account and it takes a few seconds. We will bring you back here with this order ready. <button className="linkbtn" onClick={signInHere}>Sign in</button></p>}
              <dl className="mstats">
                <div><dt>Last sale</dt><dd>{lastC !== undefined ? usdC(lastC) : '—'}</dd><small>{lastTrade ? ago(lastTrade.t * 1000, now) : s.last ? 'From the index' : 'No sales yet'}</small></div>
                <div><dt>Spread <Define term="spread">The gap between the best offer and the ask. A narrow gap means buyers and sellers agree on the price.</Define></dt><dd>{spreadInfo ? formatBps(spreadInfo.bps, { digits: 1 }) : '—'}</dd><small>{spreadInfo ? `${usdC(spreadInfo.cents)} between them` : 'Needs an ask and an offer'}</small></div>
                <div><dt>Vaulted</dt><dd>{s.vaulted}</dd><small>{s.vaulted === 1 ? 'slab backs this market' : 'slabs back this market'}</small></div>
              </dl>
              {account && s.ask && <AlertRow s={s} />}
            </div>
          )}
          <ul className="trust">
            <li><IconVault /><span><b>Held in the vault</b>{net.name === 'testnet' ? 'Custody is simulated on the test network.' : 'Each token is backed by one graded slab.'} <button className="linkbtn" onClick={() => document.getElementById('vault')?.scrollIntoView({ behavior: 'smooth' })}>See verification</button></span></li>
            <li><IconCheck /><span><b>{net.name === 'testnet' ? 'Simulated check' : 'Certificate matched'}</b>{net.name === 'testnet' ? 'Certificates are matched against a demo registry.' : 'Matched against the grader’s registry before listing.'}</span></li>
            <li><IconActivity /><span><b>Settles on {net.chain.name}</b>Every order and trade is an on-chain transaction you can look up.</span></li>
          </ul>
        </aside>
      </div>

      <div className="cx-rest">
      {live && (
        <>
          <nav className="section-nav" aria-label="On this page">
            {SECTIONS.filter(([k]) => (k !== 'about' || c?.about) && (k !== 'position' || owned > 0n || mine.length > 0)).map(([k, l]) => (
              <button key={k} onClick={() => document.getElementById(k)?.scrollIntoView({ behavior: 'smooth' })}>
                {l}
              </button>
            ))}
          </nav>

          <div className="pdp-cols">
          <div className="pdp-main">
            <section id="history" className="pnl pnl-wide" aria-labelledby="h-history">
              <header className="pnl-h">
                <h2 id="h-history">Price history</h2>
                <span className="pnl-meta">{h.data?.source === 'envio' ? 'On-chain trades, indexed by Envio' : 'Monad RPC logs, about the last 20 minutes'}</span>
              </header>
              {h.error && !h.data ? <ErrorNote what="Couldn’t load the trades." why={h.error} next="Try again in a moment." onRetry={h.refresh} /> : !h.data ? <Skeleton h={300} r={12} /> : (
                <Suspense fallback={<Skeleton h={300} r={12} />}>
                  <PriceChart trades={trades} askCents={askC} bidCents={bidC} updatedAt={d.at} />
                </Suspense>
              )}
            </section>

            <section id="trades" className="pnl pnl-wide" aria-labelledby="h-trades">
              <header className="pnl-h"><h2 id="h-trades">Trades</h2><span className="pnl-meta">{fills.length ? `${fills.length} recorded` : 'None yet'}</span></header>
              {fills.length === 0 ? (
                <div className="pnl-empty">
                  <IconActivity />
                  <b>No trades at this grade yet</b>
                  <p className="fine">The first one shows here the moment it settles on {net.chain.name}.</p>
                  {askC !== undefined && <Button variant="secondary" size={40} onClick={() => (setMode('offer'), setPrefill({}), window.scrollTo({ top: 0, behavior: 'smooth' }))}>Make the first offer</Button>}
                </div>
              ) : (
                <div className="pnl-table">
                  <table className="booktable" aria-label="Recent trades">
                    <thead><tr><th scope="col">Time</th><th scope="col" className="num">Price</th><th scope="col" className="num">Cards</th><th scope="col" className="num">Transaction</th></tr></thead>
                    <tbody>
                      {[...fills].reverse().slice(0, 50).map((f, i) => (
                        <tr key={i}>
                          <td title={when(f.t)}>{when(f.t)} <span className="muted">· {ago(f.t * 1000, now)}</span></td>
                          <td className="num"><b>{usdC(cents(f.price))}</b></td>
                          <td className="num">{formatQty(BigInt(f.size))}</td>
                          <td className="num">{f.hash ? <a className="linkbtn" href={`${net.chain.blockExplorers?.default.url}/tx/${f.hash}`} target="_blank" rel="noreferrer">View</a> : <span className="na">Not recorded</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {c?.about && (
              <section id="about" className="pnl pnl-full" aria-labelledby="h-about">
                <header className="pnl-h"><h2 id="h-about">About this card</h2><span className="pnl-meta">Source: {c.about.source}</span></header>
                <p className="about-text">{c.about.text}</p>
              </section>
            )}

            {(owned > 0n || mine.length > 0) && (
              <section id="position" className="pnl pnl-full" aria-labelledby="h-position">
                <header className="pnl-h"><h2 id="h-position">Your position</h2></header>
                <dl className="vals">
                  <div><dt>Holdings</dt><dd>{formatQty(owned)}</dd><small>{listed > 0n ? `${formatQty(listed)} listed for sale` : 'In your account'}</small></div>
                  <div><dt>Average cost</dt><dd>{avg ? usdU(avg.avgUnits, 2) : '—'}</dd><small>{avg ? `Average price of ${formatQty(avg.qty)} purchase${avg.qty === 1n ? '' : 's'} on this market` : 'Needs a card bought on this market'}</small></div>
                  <div><dt>Unrealised P&amp;L</dt><dd>{avg && bidC !== undefined ? usdU(unrealisedPnl(owned, avg.avgUnits, centsToUnits(bidC)), 2) : '—'}</dd><small>{avg && bidC !== undefined ? 'Valued at the best offer, against your average cost' : 'Needs a cost and an offer to value against'}</small></div>
                </dl>
                {mine.length > 0 && (
                  <div className="pnl-table">
                    <table className="booktable" aria-label="Your open orders">
                      <thead><tr><th scope="col">Side</th><th scope="col" className="num">Price</th><th scope="col" className="num">Cards</th><th scope="col"><span className="sr">Actions</span></th></tr></thead>
                      <tbody>
                        {mine.map((o) => (
                          <tr key={o.id}>
                            <td>{o.isBuy ? 'Offer' : 'Ask'}</td>
                            <td className="num">{usdC(o.priceCents)}</td>
                            <td className="num">{formatQty(o.size)}</td>
                            <td className="num">{ctx && <Button variant="secondary" size={32} onClick={() => tx.open(cancelOrder(ctx, o))}>Cancel</Button>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            <section id="vault" className="pnl pnl-full" aria-labelledby="h-vault">
              <header className="pnl-h">
                <h2 id="h-vault">Vault and verification</h2>
                <span className="pnl-meta">{s.vaulted === 0 ? 'No slabs in the vault' : `${s.vaulted} slab${s.vaulted === 1 ? '' : 's'} back this market`}</span>
              </header>
              <VaultInfo s={s} certs={certs.data} />
            </section>
          </div>
          <aside className="pdp-side" aria-label="Order book and grades">
            <section id="book" className="pnl" aria-labelledby="h-book">
              <header className="pnl-h"><h2 id="h-book">Order book</h2><Updated at={d.at} /></header>
              <OrderBook asks={asksAgg} bids={bidsAgg} mine={mine} spread={spreadInfo} onPick={pick} />
              <p className="fine pnl-foot">Select a price to fill the order form with it.</p>
            </section>

            <section id="grades" className="pnl" aria-labelledby="h-grades">
              <header className="pnl-h"><h2 id="h-grades">All grades</h2><span className="pnl-meta">{sibs.length} market{sibs.length === 1 ? '' : 's'}</span></header>
              <ul className="grade-list">
                {sibs.map((x) => (
                  <li key={x.sku}>
                    <a href={`#/card/${x.sku}`} aria-current={x.sku === sku ? 'page' : undefined}>
                      <span className="gl-grade"><small>{parseName(x.name).grader}</small><b>{parseName(x.name).grade}</b></span>
                      <span className="gl-figs">
                        <span><small>Ask</small><b>{x.ask ? usdC(cents(x.ask)) : '—'}</b></span>
                        <span><small>Offer</small><b>{x.bid ? usdC(cents(x.bid)) : '—'}</b></span>
                        <span><small>Vaulted</small><b>{x.vaulted}</b></span>
                      </span>
                      {x.sku === sku && <em className="gl-here">Viewing</em>}
                    </a>
                  </li>
                ))}
              </ul>
              {sibs.length > 1 && <a className="linkbtn" href={`#/compare?ids=${sibs.map((x) => x.sku).join(',')}`}>Compare grades side by side</a>}
            </section>

          </aside>
          </div>

          {sibs.length > 0 && all.some((x) => x.sku !== sku && catalogOf(x.name)?.set === c?.set) && (
            <section className="related" aria-labelledby="h-related">
              <div className="block-head"><h2 id="h-related">More from {c?.set ?? 'this set'}</h2><a href="#/browse">Browse all</a></div>
              <div className="related-grid">
                {all.filter((x) => x.sku !== sku && catalogOf(x.name)?.set === c?.set).slice(0, 5).map((x) => <MarketTile key={x.sku} s={x} pts={[]} />)}
              </div>
            </section>
          )}
        </>
      )}
      </div>

      {live && barOn && (
        <div className="sticky-bar-m" role="region" aria-label="Quick actions">
          <div className="sticky-in">
            {askC !== undefined ? <Button size={40} onClick={() => (setMode('buy'), setPrefill({}), window.scrollTo({ top: 0, behavior: 'smooth' }))}>Buy for {usdC(askC)}</Button> : <Button size={40} onClick={() => (setMode('offer'), setPrefill({}), window.scrollTo({ top: 0, behavior: 'smooth' }))}>Make offer</Button>}
          </div>
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------- the order form
export function OrderForm({ mode, ctx, asks, bids, askC, bidC, owned, prefill, onClose }: { mode: 'buy' | 'offer' | 'sell'; ctx: Ctx; asks: Level[]; bids: Level[]; askC?: bigint; bidC?: bigint; owned: bigint; prefill: { price?: string; qty?: string; sellMode?: 'now' | 'list' }; onClose: () => void }) {
  const tx = useTx()
  const [qty, setQty] = useState(prefill.qty ?? '1')
  const [price, setPrice] = useState(prefill.price ?? (mode === 'offer' && bidC !== undefined ? String(Number(bidC + 100n) / 100) : mode === 'sell' && askC !== undefined ? String(Number(askC) / 100) : ''))
  const [sm, setSm] = useState<'now' | 'list'>(prefill.sellMode ?? (bidC !== undefined ? 'now' : 'list'))
  const [errs, setErrs] = useState<string[]>([])
  const q = /^\d+$/.test(qty) ? BigInt(qty) : 0n
  const px = /^\d+(\.\d{0,2})?$/.test(price) ? BigInt(Math.round(Number(price) * 100)) : 0n
  const walk = mode === 'buy' ? walkAsks(asks, q) : mode === 'sell' && sm === 'now' ? walkBids(bids, q) : undefined
  const review = () => {
    const b: Built = mode === 'buy' ? buyNow(ctx, asks, q) : mode === 'offer' ? makeOffer(ctx, px, q, askC) : sm === 'now' ? sellNow(ctx, bids, q) : listAsk(ctx, px, q, bidC)
    setErrs(b.problems)
    if (b.spec) tx.open(b.spec)
  }
  const title = mode === 'buy' ? 'Buy now' : mode === 'offer' ? 'Make an offer' : 'Sell'
  return (
    <section className="order-form" id="order-form" aria-label={title}>
      <div className="sec-head"><h3>{title}</h3><button className="linkbtn" onClick={onClose}>Close</button></div>
      {mode === 'sell' && <Seg label="How to sell" value={sm} onChange={setSm} options={[{ value: 'now', label: 'Sell now' }, { value: 'list', label: 'List at your price' }]} />}
      <div className="order-fields">
        <label className="lab">
          Cards
          <input className="num-in" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} aria-label="Number of cards" />
        </label>
        {(mode === 'offer' || (mode === 'sell' && sm === 'list')) && (
          <label className="lab">
            {mode === 'offer' ? 'Your offer, per card' : 'Your price, per card'}
            <input className="num-in" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} aria-label="Price in dollars" placeholder="0.00" />
          </label>
        )}
      </div>
      {walk && q > 0n && (
        <p className="fine" role="status">
          {walk.qty < q ? `${formatQty(walk.qty)} available at the moment.` : <>{walk.levels > 1 ? `Average ${usdC(walk.avgCents)}, worst ${usdC(walk.limitCents)}.` : `${usdC(walk.avgCents)} each.`} Total {usdU(walk.units, 2)}.</>}
        </p>
      )}
      {mode === 'sell' && owned < q && <p className="fine">You hold {formatQty(owned)}.</p>}
      {errs.length > 0 && (
        <ul className="problems" role="alert">
          {errs.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      <Button size={48} onClick={review}>Review {mode === 'buy' ? 'purchase' : mode === 'offer' ? 'offer' : sm === 'now' ? 'sale' : 'listing'}</Button>
      <p className="fine">Nothing is sent until you confirm on the review screen.</p>
    </section>
  )
}

// ---------------------------------------------------------------- the order book
function OrderBook({ asks, bids, mine, spread: sp, onPick }: { asks: ReturnType<typeof aggregate>; bids: ReturnType<typeof aggregate>; mine: { priceCents: bigint; isBuy: boolean }[]; spread?: { cents: bigint; bps: bigint }; onPick: (side: 'ask' | 'bid', l: { price: bigint; cumulative: bigint }) => void }) {
  if (!asks.length && !bids.length) return <p className="fine">The book is empty. Nobody has posted an ask or an offer yet.</p>
  const yours = (price: bigint, isBuy: boolean) => mine.some((o) => o.priceCents === price && o.isBuy === isBuy)
  const row = (side: 'ask' | 'bid') => (l: (typeof asks)[number]) => (
    <li key={String(l.price)} className={side}>
      <button onClick={() => onPick(side, l)} aria-label={`${side === 'ask' ? 'Ask' : 'Offer'} ${usdC(l.price)}, ${l.size} card${l.size === 1n ? '' : 's'}. Fill the order form`}>
        <i className="depth" style={{ width: `${Number(l.depthBps) / 100}%` }} aria-hidden />
        <span className="num">{usdC(l.price)}{yours(l.price, side === 'bid') && <em className="yours"> Yours</em>}</span>
        <span className="num">{formatQty(l.size)}</span>
        <span className="num">{formatQty(l.cumulative)}</span>
      </button>
    </li>
  )
  return (
    <div className="book2" role="group" aria-label="Order book">
      <div className="book2-head"><span>Price</span><span>Cards</span><span>Total cards</span></div>
      <ul aria-label="Asks, highest first">{[...asks].reverse().map(row('ask'))}</ul>
      <div className="book2-spread" role="status">{sp ? <>Spread {usdC(sp.cents)} · {formatBps(sp.bps, { digits: 1 })} of the ask</> : asks.length ? 'No offers yet' : 'No one is selling'}</div>
      <ul aria-label="Offers, highest first">{bids.map(row('bid'))}</ul>
    </div>
  )
}

// ---------------------------------------------------------------- vault and verification
function VaultInfo({ s, certs }: { s: Sku; certs?: CertRow[] }) {
  const test = net.name === 'testnet'
  const status = (x: string) => (x === 'VAULTED' ? 'Vaulted' : x === 'REDEEMED' ? 'Redeemed' : x === 'ATTESTED' ? 'Attested' : x)
  return (
    <div className="vault-grid">
      <div className="vault-certs">
        <h3 className="lbl-caps">Certificates</h3>
        {certs === undefined ? <p className="fine">Certificate numbers appear here once the indexer is connected.</p> : certs.length === 0 ? <p className="fine">No certificates recorded for this market yet.</p> : (
          <ul className="cert-list">
            {certs.map((x) => (
              <li key={x.id}>
                <span className="cert-id"><small>PSA</small><Copyable value={x.id} label="certificate number" /></span>
                <span className={`pill-s ${x.status === 'VAULTED' ? 'ok' : ''}`}>{status(x.status)}</span>
                <span className="fine">{when(x.updatedAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="fine">Many slabs back one market, so each token stands for any one of them.</p>
      </div>
      <div className="vault-facts">
        <dl className="fact-tiles">
          <div><dt>Registry check</dt><dd>{test ? 'Simulated against a demo registry' : 'Checked by the attestor before vaulting'}</dd></div>
          <div><dt>Custody</dt><dd>{test ? 'Simulated: a demo custodian confirms receipt at once' : 'A vault partner checks each slab in'}</dd></div>
          <div><dt>Token contract</dt><dd><a className="linkbtn" href={explorerAddress(s.token)} target="_blank" rel="noreferrer">View on the explorer</a></dd></div>
          <div><dt>Order book contract</dt><dd><a className="linkbtn" href={explorerAddress(s.market)} target="_blank" rel="noreferrer">View on the explorer</a></dd></div>
        </dl>
        <div className="chain-split">
          <div><b>On {net.chain.name}</b><p className="fine">Who owns each token, every order and every trade. Each links to the explorer.</p></div>
          <div><b>Off chain</b><p className="fine">The physical slab in the vault, and the check of its certificate.</p></div>
        </div>
      </div>
    </div>
  )
}

function AlertRow({ s }: { s: Sku }) {
  const al = useAlerts()
  const cur = al.has(s.sku, 'below')
  const target = cur?.price ?? (s.ask ? alertPrice(s.ask) : undefined)
  const [blocked, setBlocked] = useState(false)
  if (!target) return null
  return (
    <div className="kv alertrow">
      <span>
        Tell me if the ask drops below {usdC(cents(target))}
        <span className="fine" style={{ display: 'block' }}>{blocked ? 'Allow notifications in your browser first.' : 'One notification, then it turns off. Works while the app is open.'}</span>
      </span>
      <button className="switch" role="switch" aria-checked={!!cur} aria-label={`Alert when the ask drops below ${usdC(cents(target))}`} onClick={async () => (cur ? al.off(s.sku, 'below') : setBlocked(!(await al.on({ sku: s.sku, kind: 'below', price: target }))))} />
    </div>
  )
}
