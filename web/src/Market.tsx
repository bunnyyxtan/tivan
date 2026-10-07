import { useState } from 'react'
import type { LocalAccount } from 'viem'
import { alertPrice, useAlerts } from './alerts'
import { brand, catalogOf, categories, categoryOf, net } from './config'
import { bookAbi, decodeL2, hasMarket, lastPaid, loadSkus, openOrders, pub, send, tradeHistory, type Fill, type Level, type Order, type Sku } from './chain'
import { usePortfolio } from './portfolio'
import { ActivityFeed, FoundingCollectors } from './Feed'
import { priceCard, shareCard } from './share'
import { CashPill, type Acct } from './App'
import { Header, Roll, Slab, Steps, Toast, cardSub, cardTitle, delta, parseName, useFlow, usePoll, useTint, useWatch, usd } from './ui'

export function MarketList({ account }: { account: Acct }) {
  const { data, error } = usePoll(loadSkus, 8000, [])
  const { data: port } = usePortfolio(account?.address)
  const watch = useWatch()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')
  const owned = (sku: string) => port?.holdings.find((h) => h.s.sku === sku)
  const list = (data ?? []).filter(
    (s) => `${s.name} ${catalogOf(s.name)?.set ?? ''}`.toLowerCase().includes(q.toLowerCase()) && (cat === 'All' || (cat === 'Watching' ? watch.list.includes(s.sku) : categoryOf(s.name) === cat)),
  )
  return (
    <>
      <Header title="Markets" right={<span className="mobile-only"><CashPill account={account} /></span>} />
      {net.name === 'mainnet' && <DemoNotice />}
      <label className="field" style={{ marginTop: 4 }}>
        <input aria-label="Search cards" placeholder="Search a card or set" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="chips" role="group" aria-label="Filter" style={{ marginTop: 14 }}>
        {['All', 'Watching', ...categories].map((c) => (
          <button key={c} className={cat === c ? 'on' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>
      <div className="market-table" style={{ marginTop: 6 }}>
        <div className="list-head">
          <span className="cap">{data ? `${list.length} ${list.length === 1 ? 'card' : 'cards'}` : 'Cards'}</span>
          <span className="desk-only cap">Buy now</span>
          <span className="desk-only cap">Sell now</span>
          <span className="desk-only cap">In the vault</span>
          <span className="mobile-only fine">Price to buy</span>
        </div>
        {!net.vault && <div className="empty">Markets open on {net.chain.name} soon.</div>}
        {!data && !error && net.vault && [0, 1, 2].map((i) => <div key={i} className="skeleton" />)}
        {error && !data && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {data && !list.length && (
          <div className="empty">{cat === 'Watching' ? 'Nothing here yet. Tap Watch on any card and it shows up here.' : 'No cards match.'}</div>
        )}
        {list.map((s) => {
          const o = owned(s.sku)
          const tag = o && o.count > 0 ? `You own ${o.count}${o.listed ? ' · listed' : ''}` : watch.list.includes(s.sku) ? 'Watching' : ''
          return <MarketRow key={s.sku} s={s} tag={tag} />
        })}
      </div>
      <ActivityFeed me={account?.address} />
    </>
  )
}

/** Honest label for the mainnet placeholder SKUs: real tokens, no cards behind them, markets not live yet. */
const DemoNotice = () => (
  <p className="notice" style={{ marginBottom: 14 }}>
    <b>Demo listings.</b> These Monad mainnet tokens have no physical cards behind them. Trading opens once Kuru lists their markets.
  </p>
)

function MarketRow({ s, tag }: { s: Sku; tag: string }) {
  const { demo } = parseName(s.name)
  const live = hasMarket(s)
  const ask = !live ? 'Opening soon' : s.ask ? usd(s.ask) : 'No sellers'
  const second = !live ? 'Awaiting Kuru' : s.bid ? `Offer ${usd(s.bid)}` : 'No offers'
  return (
    <a className="mrow rise" href={`#/card/${s.sku}`}>
      <span className="mrow-name">
        <Slab name={s.name} size="xs" vt={`card-${s.sku}`} />
        <span className="mrow-info">
          <span className="mrow-title">{cardTitle(s.name)}</span>
          <span className="mrow-sub">
            {demo ? 'DEMO · ' : ''}
            {cardSub(s.name)}
          </span>
          {tag && <span className="mrow-tag">{tag}</span>}
        </span>
      </span>
      <span className="mrow-px">
        <span style={{ color: live && s.ask ? undefined : 'var(--tx2)' }}>{ask}</span>
        <span>{second}</span>
      </span>
      <span className="mrow-cells">
        <span>{ask}</span>
        <span>{live && s.bid ? usd(s.bid) : '—'}</span>
        <span>{s.vaulted} in vault</span>
      </span>
    </a>
  )
}

type CardData = { sku: Sku; book: { bids: Level[]; asks: Level[] } }

export function CardPage({ sku, account }: { sku: string; account: Acct }) {
  const me = account?.address
  const { data, error, refresh } = usePoll(
    async (): Promise<CardData> => {
      const s = (await loadSkus()).find((x) => x.sku === sku)
      if (!s) throw new Error('Card not found')
      const l2 = hasMarket(s) ? await pub.readContract({ address: s.market, abi: bookAbi, functionName: 'getL2Book' }) : undefined
      return { sku: s, book: l2 ? decodeL2(l2) : { bids: [], asks: [] } }
    },
    4000,
    [sku],
  )
  const { data: hist } = usePoll(async () => (data ? tradeHistory(data.sku.market) : undefined), 15000, [data?.sku.market])
  const { data: port, refresh: refreshPort } = usePortfolio(me)
  const { data: orders = [], refresh: refreshOrders } = usePoll(async () => (me && data ? openOrders(data.sku.market, me) : []), 8000, [data?.sku.market, me])
  const watch = useWatch()
  const [toast, setToast] = useState<string>()
  useTint(data?.sku.name)

  if (!data)
    return (
      <>
        <Header back="#/" backLabel="Markets" />
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : (
          <div className="skeleton" style={{ height: 300 }} />
        )}
      </>
    )
  const { book } = data
  // Top of book from the freshly read L2 book; bestBidAsk (via loadSkus) can lag a poll behind.
  const s = {
    ...data.sku,
    ask: book.asks.length ? Math.min(...book.asks.map((l) => l.price)) : data.sku.ask,
    bid: book.bids.length ? Math.max(...book.bids.map((l) => l.price)) : data.sku.bid,
  }
  const { demo } = parseName(s.name)
  const own = (port?.holdings.find((h) => h.s.sku === sku)?.count ?? 0) + orders.filter((o) => !o.isBuy).reduce((n, o) => n + o.size, 0)
  const fills = hist?.fills ?? []
  const paid = me ? lastPaid(fills, me) : undefined
  const watching = watch.list.includes(sku)
  const live = hasMarket(s)
  const gap = s.ask && s.bid ? s.ask - s.bid : undefined
  const flash = (t: string) => (setToast(t), setTimeout(() => setToast(undefined), 2600))
  const share = async () => {
    const c = catalogOf(s.name)
    const blob = await priceCard({
      title: cardTitle(s.name),
      sub: cardSub(s.name),
      price: s.ask ? usd(s.ask) : s.bid ? usd(s.bid) : '—',
      line: s.ask ? 'to buy now' + (s.bid ? ` · top offer ${usd(s.bid)}` : '') : s.bid ? 'top offer' : 'no price yet',
      img: c?.imageUrl,
      dark: matchMedia('(prefers-color-scheme: dark)').matches,
    })
    const r = await shareCard(blob, `${cardTitle(s.name)} is ${s.ask ? usd(s.ask) : 'listed'} on ${brand}.`, location.href)
    if (r === 'saved') flash('Price card saved.')
  }
  const buttons = (
    <>
              {own > 0 ? (
                <a className="ghost line" href={`#/sell/${sku}`}>
                  Sell
                </a>
              ) : (
                <a className="ghost line" href={`#/offer/${sku}`}>
                  Make offer
                </a>
              )}
              {s.ask ? (
                <a className="btn" href={`#/buy/${sku}`}>
                  Buy for {usd(s.ask)}
                </a>
              ) : (
                <a className="btn" href={`#/offer/${sku}`}>
                  Make an offer
                </a>
              )}
    </>
  )
  return (
    <>
      <Header
        back="#/"
        backLabel="Markets"
        right={
          <span style={{ display: 'flex', gap: 8 }}>
            <button className="pill" onClick={share} aria-label="Share this price">
              Share
            </button>
            <button className={`pill ${watching ? 'on' : ''}`} aria-pressed={watching} onClick={() => flash(watch.toggle(sku) ? 'Added to Watching.' : 'Removed from Watching.')}>
            {watching ? 'Watching' : 'Watch'}
          </button>
          </span>
        }
      />
    <div className="card-layout">
      <div className="card-hero">
        <Slab name={s.name} size="lg" tilt vt={`card-${s.sku}`} />
      </div>
      <div>
        <div className="rise">
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.03em' }}>{cardTitle(s.name)}</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 15 }}>
            {demo ? 'DEMO · ' : ''}
            {cardSub(s.name)}
          </p>
        </div>

        {!live ? (
          <div className="panel" style={{ marginTop: 20 }}>
            <b style={{ fontWeight: 500 }}>Market opening soon</b>
            <p className="fine" style={{ marginTop: 6 }}>
              This card’s token is live on {net.chain.name}, but Kuru deploys mainnet order books itself. Once Kuru lists it, buying, selling and offers open here.
              {demo ? ' Demo listing: no physical card backs this token.' : ''}
            </p>
          </div>
        ) : (
          <>
            <div className="quote rise" style={{ marginTop: 20 }}>
              <div>
                <span className="cap">Buy now</span>
                <div className="big">{s.ask ? <Roll value={s.ask} /> : '—'}</div>
                <p className="fine">{s.ask ? `${book.asks.reduce((n, l) => n + l.size, 0)} for sale` : 'No sellers yet'}</p>
              </div>
              <div>
                <span className="cap">Sell now</span>
                <div className="big muted">{s.bid ? <Roll value={s.bid} /> : '—'}</div>
                <p className="fine">{s.bid ? 'Top offer' : 'No offers yet'}</p>
              </div>
            </div>
            <p className="fine" style={{ marginTop: 10, fontSize: 14 }}>
              {gap !== undefined
                ? `Sellers want ${usd(gap)} more than buyers offer. An offer in between is the quickest way to meet.`
                : !s.ask
                  ? 'Nobody is selling right now. Make an offer and a seller can accept it instantly.'
                  : 'No offers yet. Yours would be the first.'}
            </p>
            <div className="actions desk-only" style={{ marginTop: 16 }}>
              {buttons}
            </div>
            {s.ask && <AlertRow s={s} flash={flash} />}
            {own > 0 && (
              <div className="kv" style={{ marginTop: 10, borderTop: '1px solid var(--line)' }}>
                <span>You own {own}</span>
                <span>
                  {paid !== undefined && s.bid ? (
                    <>
                      Paid {usd(paid)} · <span className={s.bid - paid >= 0 ? 'up' : 'down'}>{delta(s.bid - paid)} if sold now</span>
                    </>
                  ) : s.bid ? (
                    `Worth ${usd(s.bid * own)} now`
                  ) : (
                    ''
                  )}
                </span>
              </div>
            )}

            <Activity fills={fills} book={book} />
            <FoundingCollectors market={s.market} me={me} />
            {orders.length > 0 && account && <OpenOrders orders={orders} s={s} account={account} done={() => (refresh(), refreshOrders(), refreshPort())} />}
          </>
        )}

        <section className="section">
          <span className="cap">What you’re buying</span>
          <div className="rows">
            <div className="kv">
              <span>The card</span>
              <span>{demo ? 'Demo token, no card behind it' : `One graded slab, ${s.vaulted} in the vault`}</span>
            </div>
            <div className="kv">
              <span>Grade</span>
              <span>Checked against the PSA registry by Chainlink</span>
            </div>
            <div className="kv">
              <span>Want it in hand?</span>
              <span>{own > 0 ? <a className="u" href={`#/redeem/${sku}`}>Request the slab</a> : 'Own one, then request it'}</span>
            </div>
          </div>
        </section>

        {live && (
          <div className="sticky-bar mobile-only" style={{ marginTop: 24 }}>
            <div>{buttons}</div>
          </div>
        )}
        <div style={{ height: 90 }} className="mobile-only" />
      </div>
      {toast && <Toast text={toast} />}
    </div>
    </>
  )
}

function AlertRow({ s, flash }: { s: Sku; flash: (t: string) => void }) {
  const al = useAlerts()
  const cur = al.has(s.sku, 'below')
  const target = cur?.price ?? (s.ask ? alertPrice(s.ask) : undefined)
  if (!target) return null
  const toggle = async () => {
    if (cur) return al.off(s.sku, 'below')
    if (!(await al.on({ sku: s.sku, kind: 'below', price: target }))) flash('Allow notifications in your browser to use alerts.')
  }
  return (
    <div className="kv" style={{ marginTop: 10, alignItems: 'center' }}>
      <span>
        Tell me if it drops below {usd(target)}
        <span className="fine" style={{ display: 'block' }}>
          One notification, then it turns off. Works while {brand} is open.
        </span>
      </span>
      <button className="switch" role="switch" aria-checked={!!cur} aria-label={`Alert when below ${usd(target)}`} onClick={toggle} />
    </div>
  )
}

/** Real sales plus what is on the book right now. The chart only appears once there are two sales to draw. */
function Activity({ fills, book }: { fills: Fill[]; book: { bids: Level[]; asks: Level[] } }) {
  const t = (x: number) => new Date(x * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const asks = [...book.asks].sort((a, b) => a.price - b.price).slice(0, 3)
  const bids = [...book.bids].sort((a, b) => b.price - a.price).slice(0, 3)
  const change = fills.length > 1 ? (fills.at(-1)!.price - fills.at(-2)!.price) / fills.at(-2)!.price : undefined
  return (
    <section className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span className="cap">Activity</span>
        <span className="fine">
          {change !== undefined ? change === 0 ? 'Flat since the previous sale' : <span className={change > 0 ? 'up' : 'down'}>{`${change > 0 ? '▲' : '▼'} ${Math.abs(change * 100).toFixed(1)}% since the previous sale`}</span> : fills.length ? '1 sale so far' : 'No sales yet'}
        </span>
      </div>
      {fills.length > 1 && <Chart fills={fills} />}
      <div className="rows">
        {[...fills].reverse().slice(0, 4).map((f, i) => (
          <div className="kv" key={'f' + i}>
            <span>Sold</span>
            <span>
              <span className="muted" style={{ marginRight: 12 }}>
                {t(f.t)}
              </span>
              {usd(f.price)}
            </span>
          </div>
        ))}
        {asks.map((l, i) => (
          <div className="kv" key={'a' + i}>
            <span>{l.size} for sale</span>
            <span>{usd(l.price)}</span>
          </div>
        ))}
        {bids.map((l, i) => (
          <div className="kv" key={'b' + i}>
            <span>
              {l.size} {l.size === 1 ? 'offer' : 'offers'}
            </span>
            <span>{usd(l.price)}</span>
          </div>
        ))}
      </div>
      {fills.length < 2 && <p className="fine" style={{ marginTop: 8 }}>A price chart appears after the second sale. We don’t draw lines from guesses.</p>}
    </section>
  )
}

function Chart({ fills }: { fills: Fill[] }) {
  const W = 320
  const H = 110
  const ps = fills.map((f) => f.price)
  const pad = Math.max(1, (Math.max(...ps) - Math.min(...ps)) * 0.25)
  const lo = Math.min(...ps) - pad
  const hi = Math.max(...ps) + pad
  const t0 = fills[0].t
  const span = Math.max(60, Date.now() / 1000 - t0)
  const pts = fills.map((f) => [6 + ((f.t - t0) / span) * (W - 12), H - 6 - ((f.price - lo) / (hi - lo)) * (H - 12)])
  // Step line: each price holds until the next sale, and the last one runs to now.
  const d = pts.map(([x, y], i) => (i ? `H${x.toFixed(1)}V${y.toFixed(1)}` : `M${x.toFixed(1)},${y.toFixed(1)}`)).join('') + `H${W - 6}`
  return (
    <div className="chart" style={{ margin: '4px 0 8px' }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Sale prices from ${usd(ps[0])} to ${usd(ps.at(-1))}`}>
        <path d={d} fill="none" stroke="var(--tx)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="3" fill="var(--bg)" stroke="var(--tx)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
    </div>
  )
}

function OpenOrders({ orders, s, account, done }: { orders: Order[]; s: Sku; account: LocalAccount; done: () => void }) {
  const flow = useFlow()
  const cancel = async (o: Order) => {
    if (await flow.run([[`Cancel your ${o.isBuy ? 'offer' : 'listing'} at ${usd(o.price)}`, async () => (await send(account, { address: s.market, abi: bookAbi, functionName: 'batchCancelOrders', args: [[o.id]] })).transactionHash]])) done()
  }
  return (
    <section className="section">
      <span className="cap">Your orders</span>
      <div className="rows">
        {orders.map((o) => (
          <div key={o.id} className="kv" style={{ alignItems: 'center' }}>
            <span>
              {o.isBuy ? 'Offer' : 'For sale'} · {o.size} at {usd(o.price)}
            </span>
            <button className="ghost pill" disabled={flow.busy} onClick={() => cancel(o)}>
              Cancel
            </button>
          </div>
        ))}
      </div>
      <Steps steps={flow.steps} error={flow.error} />
    </section>
  )
}
