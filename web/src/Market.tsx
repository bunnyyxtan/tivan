import { useState } from 'react'
import type { LocalAccount } from 'viem'
import { alertPrice, useAlerts } from './alerts'
import { brand, catalogOf, categories, categoryOf, net } from './config'
import { bookAbi, decodeL2, hasMarket, lastPaid, loadSkus, openOrders, pub, send, tradeHistory, type Fill, type Level, type Order, type Sku } from './chain'
import { usePortfolio } from './portfolio'
import { ActivityFeed, FoundingCollectors } from './Feed'
import { priceCard, shareCard } from './share'
import { CashPill, type Acct } from './App'
import { usePrefs } from './fx'
import { IconClose, IconGrid, IconList } from './icons'
import { Empty, ErrorNote, ItemCardSkeleton, RowSkeleton, Skeleton } from './States'
import { pct, stamp } from './format'
import { Header, Roll, Slab, Steps, Toast, cardSub, cardTitle, delta, parseName, useFlow, usePoll, useWatch, usd } from './ui'

// ===================================================================== browse
type Sort = 'featured' | 'high' | 'low' | 'spread' | 'name'
type Grade = 'any' | '10' | '9' | 'lower'
const price = (s: Sku) => s.ask ?? s.bid ?? 0
const spreadOf = (s: Sku) => (s.ask && s.bid ? (s.ask - s.bid) / s.ask : undefined)
const gradeOf = (s: Sku) => Number(parseName(s.name).grade)
const grades: [Grade, string][] = [['any', 'Any grade'], ['10', 'PSA 10'], ['9', 'PSA 9'], ['lower', 'PSA 8 or lower']]
const gradeLabel = (g: Grade) => grades.find((x) => x[0] === g)![1]
const matchesGrade = (s: Sku, g: Grade) => g === 'any' || (g === 'lower' ? gradeOf(s) <= 8 : gradeOf(s) === Number(g))

export function MarketList({ account }: { account: Acct }) {
  const { data, error, refresh } = usePoll(loadSkus, 8000, [])
  const { data: port } = usePortfolio(account?.address)
  const watch = useWatch()
  const [prefs, setPrefs] = usePrefs()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')
  const [grade, setGrade] = useState<Grade>('any')
  const [sort, setSort] = useState<Sort>('featured')
  const [forSale, setForSale] = useState(false)
  const owned = (sku: string) => port?.holdings.find((h) => h.s.sku === sku)
  const all = data ?? []
  const list = all
    .filter((s) => `${s.name} ${catalogOf(s.name)?.set ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((s) => cat === 'All' || (cat === 'Watching' ? watch.list.includes(s.sku) : categoryOf(s.name) === cat))
    .filter((s) => matchesGrade(s, grade) && (!forSale || !!s.ask))
    .sort((x, y) => (sort === 'high' ? price(y) - price(x) : sort === 'low' ? price(x) - price(y) : sort === 'spread' ? (spreadOf(y) ?? -1) - (spreadOf(x) ?? -1) : sort === 'name' ? cardTitle(x.name).localeCompare(cardTitle(y.name)) : 0))
  const tag = (s: Sku) => {
    const o = owned(s.sku)
    return o && o.count > 0 ? `You own ${o.count}${o.listed ? ' · listed' : ''}` : watch.list.includes(s.sku) ? 'Watching' : ''
  }
  const count = (c: string) => all.filter((s) => categoryOf(s.name) === c).length
  const active = [q.trim() && { k: 'q', label: `“${q.trim()}”`, off: () => setQ('') }, cat !== 'All' && { k: 'c', label: cat, off: () => setCat('All') }, grade !== 'any' && { k: 'g', label: gradeLabel(grade), off: () => setGrade('any') }, forSale && { k: 's', label: 'For sale only', off: () => setForSale(false) }].filter(Boolean) as { k: string; label: string; off: () => void }[]
  const clear = () => (setQ(''), setCat('All'), setGrade('any'), setForSale(false))
  return (
    <>
      <Header title="Markets" right={<span className="mobile-only"><CashPill account={account} /></span>} />
      {net.name === 'mainnet' && <DemoNotice />}
      <label className="field" style={{ marginTop: 4 }}>
        <input aria-label="Search cards" placeholder="Search a card or set" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="chips" role="group" aria-label="Category" style={{ marginTop: 14 }}>
        {['All', 'Watching', ...categories].map((c) => (
          <button key={c} className={cat === c ? 'on' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>
            {c}
            {data && c !== 'All' && c !== 'Watching' ? <span className="muted" style={{ marginLeft: 6 }}>{count(c)}</span> : null}
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Grade" style={{ marginTop: 8 }}>
        {grades.map(([k, label]) => (
          <button key={k} className={grade === k ? 'on' : ''} aria-pressed={grade === k} onClick={() => setGrade(k)}>
            {label}
          </button>
        ))}
        <button className={forSale ? 'on' : ''} aria-pressed={forSale} onClick={() => setForSale(!forSale)}>
          For sale only
        </button>
      </div>
      <div className="browse-bar">
        <label className="field">
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="featured">Sort: Default</option>
            <option value="high">Price, high to low</option>
            <option value="low">Price, low to high</option>
            <option value="spread">Biggest spread</option>
            <option value="name">Name, A to Z</option>
          </select>
        </label>
        <span className="seg" role="radiogroup" aria-label="View">
          {(['grid', 'list'] as const).map((v) => (
            <button key={v} role="radio" aria-checked={prefs.view === v} aria-label={v === 'grid' ? 'Grid view' : 'List view'} className={prefs.view === v ? 'on' : ''} onClick={() => setPrefs({ view: v })}>
              {v === 'grid' ? <IconGrid size={16} /> : <IconList size={16} />}
            </button>
          ))}
        </span>
      </div>
      {active.length > 0 && (
        <div className="chips" role="group" aria-label="Active filters" style={{ marginTop: 10 }}>
          <span className="chips-label">Filtered by</span>
          {active.map((a) => (
            <button key={a.k} className="x" onClick={a.off} aria-label={`Remove filter ${a.label}`}>
              {a.label}
              <IconClose />
            </button>
          ))}
          <button className="ghost" onClick={clear}>Clear all</button>
        </div>
      )}

      <div className="list-head" role="status">
        <span>{data ? `${list.length} of ${all.length} cards` : 'Loading cards'}</span>
        {prefs.view === 'list' && <span className="desk-only">Ask</span>}
        {prefs.view === 'list' && <span className="desk-only">Offer</span>}
        {prefs.view === 'list' && <span className="desk-only">Last sale</span>}
      </div>
      {!net.vault && <Empty title={`Markets open on ${net.chain.name} soon`} />}
      {error && !data && <ErrorNote what="Couldn’t load the markets." why={error} next="Check your connection, then try again." onRetry={refresh} />}
      {!data && !error && net.vault && (prefs.view === 'grid' ? <div className="item-grid">{[0, 1, 2, 3, 4, 5].map((i) => <ItemCardSkeleton key={i} />)}</div> : [0, 1, 2, 3].map((i) => <RowSkeleton key={i} />))}
      {data && !list.length && (
        <Empty
          title={q.trim() ? `No cards match “${q.trim()}”` : cat === 'Watching' ? 'Nothing watched yet' : 'No cards match these filters'}
          detail={cat === 'Watching' && !q.trim() ? 'Tap Watch on any card and it shows up here.' : 'Try fewer filters or a different search.'}
          action={<button className="ghost line" onClick={clear}>Reset filters</button>}
        />
      )}
      {data && list.length > 0 &&
        (prefs.view === 'grid' ? (
          <div className="item-grid">{list.map((s) => <ItemCard key={s.sku} s={s} tag={tag(s)} />)}</div>
        ) : (
          <div className="market-table">{list.map((s) => <ItemRow key={s.sku} s={s} tag={tag(s)} />)}</div>
        ))}
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

const askText = (s: Sku, live: boolean) => (!live ? 'Opening soon' : s.ask ? usd(s.ask) : 'No sellers')
const offerText = (s: Sku, live: boolean) => (!live ? '—' : s.bid ? usd(s.bid) : 'No offers')
const lastText = (s: Sku) => (s.last ? usd(s.last) : '—')

/** The card anatomy used everywhere: media, title, grade line, then three labelled figures in fixed positions. */
function ItemCard({ s, tag }: { s: Sku; tag: string }) {
  const { demo } = parseName(s.name)
  const live = hasMarket(s)
  return (
    <a className="item-card" href={`#/card/${s.sku}`}>
      {tag && <span className="item-badge">{tag}</span>}
      <div className="item-media">
        <Slab name={s.name} size="md" vt={`card-${s.sku}`} />
      </div>
      <div className="item-body">
        <div className="item-title">{cardTitle(s.name)}</div>
        <div className="item-sub">
          {demo ? 'DEMO · ' : ''}
          {cardSub(s.name)}
        </div>
        <dl className="figs">
          <div className="fig"><dt>Ask</dt><dd>{askText(s, live)}</dd></div>
          <div className="fig"><dt>Offer</dt><dd className="dim">{offerText(s, live)}</dd></div>
          <div className="fig"><dt>Last sale</dt><dd className="dim">{lastText(s)}</dd></div>
        </dl>
      </div>
    </a>
  )
}

/** The same information as the grid card, laid out as a row. */
function ItemRow({ s, tag }: { s: Sku; tag: string }) {
  const { demo } = parseName(s.name)
  const live = hasMarket(s)
  return (
    <a className="mrow" href={`#/card/${s.sku}`}>
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
      <dl className="mrow-px figs">
        <div className="fig"><dt>Ask</dt><dd>{askText(s, live)}</dd></div>
        <div className="fig"><dt>Offer</dt><dd className="dim">{offerText(s, live)}</dd></div>
        <div className="fig"><dt>Last sale</dt><dd className="dim">{lastText(s)}</dd></div>
      </dl>
      <span className="mrow-cells">
        <span>{askText(s, live)}</span>
        <span>{offerText(s, live)}</span>
        <span>{lastText(s)}</span>
      </span>
    </a>
  )
}

// ===================================================================== detail
type CardData = { sku: Sku; book: { bids: Level[]; asks: Level[] } }
type Tab = 'details' | 'book' | 'sales'

function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const tabs: [Tab, string][] = [['details', 'Details'], ['book', 'Order book'], ['sales', 'Sales history']]
  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t[0] === value)
    const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length][0] : e.key === 'ArrowLeft' ? tabs[(i + tabs.length - 1) % tabs.length][0] : undefined
    if (!next) return
    e.preventDefault()
    onChange(next)
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus())
  }
  return (
    <div className="tabs" role="tablist" aria-label="Card information" onKeyDown={onKey}>
      {tabs.map(([k, label]) => (
        <button key={k} role="tab" id={`tab-${k}`} aria-selected={value === k} aria-controls={`panel-${k}`} tabIndex={value === k ? 0 : -1} onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  )
}

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
  const { data: all } = usePoll(loadSkus, 20000, [])
  const { data: port, refresh: refreshPort } = usePortfolio(me)
  const { data: orders = [], refresh: refreshOrders } = usePoll(async () => (me && data ? openOrders(data.sku.market, me) : []), 8000, [data?.sku.market, me])
  const watch = useWatch()
  const [toast, setToast] = useState<string>()
  const [tab, setTab] = useState<Tab>('details')

  if (!data)
    return (
      <>
        <Header back="#/" backLabel="Markets" />
        {error ? (
          <ErrorNote what="Couldn’t load this card." why={error} next="Go back to Markets or try again." onRetry={refresh} />
        ) : (
          <div className="card-layout" aria-hidden>
            <div className="card-hero"><Skeleton h={300} w={210} r={10} /></div>
            <div>
              <Skeleton h={32} w="70%" r={6} />
              <div className="stats">{[0, 1, 2].map((i) => <Skeleton key={i} h={72} r={12} />)}</div>
              <div style={{ marginTop: 22 }}><Skeleton h={180} r={12} /></div>
            </div>
          </div>
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
  const lastFill = fills.at(-1)
  const paid = me ? lastPaid(fills, me) : undefined
  const watching = watch.list.includes(sku)
  const live = hasMarket(s)
  const gap = s.ask && s.bid ? s.ask - s.bid : undefined
  const siblings = (all ?? []).filter((x) => catalogOf(x.name)?.title === catalogOf(s.name)?.title)
  const askSize = book.asks.reduce((n, l) => n + l.size, 0)
  const flash = (t: string) => (setToast(t), setTimeout(() => setToast(undefined), 2600))
  const share = async () => {
    const c = catalogOf(s.name)
    const blob = await priceCard({
      title: cardTitle(s.name),
      sub: cardSub(s.name),
      price: s.ask ? usd(s.ask) : s.bid ? usd(s.bid) : '—',
      line: s.ask ? 'to buy now' + (s.bid ? ` · top offer ${usd(s.bid)}` : '') : s.bid ? 'top offer' : 'no price yet',
      img: c?.imageUrl,
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
          <Slab name={s.name} size="lg" vt={`card-${s.sku}`} />
        </div>
        <div>
          <h1 style={{ fontSize: 32, overflowWrap: 'anywhere' }}>{cardTitle(s.name)}</h1>
          <p className="muted" style={{ marginTop: 4, fontSize: 15 }}>
            {demo ? 'DEMO · ' : ''}
            {cardSub(s.name)}
          </p>
          {siblings.length > 1 && (
            <div className="chips" role="group" aria-label="Grade" style={{ marginTop: 12 }}>
              {[...siblings].sort((a, b) => gradeOf(b) - gradeOf(a)).map((x) => (
                <a key={x.sku} href={`#/card/${x.sku}`} className={`chip ${x.sku === sku ? 'on' : ''}`} aria-current={x.sku === sku ? 'page' : undefined}>
                  PSA {gradeOf(x)} <span className="muted">{x.ask ? usd(x.ask) : 'no ask'}</span>
                </a>
              ))}
            </div>
          )}

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
              <div className="stats">
                <div className="stat">
                  <span className="lbl">Last sale</span>
                  <b>{lastFill ? usd(lastFill.price) : s.last ? usd(s.last) : '—'}</b>
                  <small>{lastFill ? stamp(lastFill.t) : s.last ? 'From the index' : 'No sales yet'}</small>
                </div>
                <div className="stat">
                  <span className="lbl">Lowest ask</span>
                  <b>{s.ask ? <Roll value={s.ask} /> : '—'}</b>
                  <small>{s.ask ? `${askSize} for sale` : 'No sellers'}</small>
                </div>
                <div className="stat">
                  <span className="lbl">Highest offer</span>
                  <b>{s.bid ? <Roll value={s.bid} /> : '—'}</b>
                  <small>{s.bid ? `${book.bids.reduce((n, l) => n + l.size, 0)} wanted` : 'No offers'}</small>
                </div>
              </div>
              <p className="fine" style={{ marginTop: 10, fontSize: 14 }}>
                {gap !== undefined && s.ask
                  ? `Spread ${usd(gap)}, ${pct(gap / s.ask)} of the ask. An offer in between is the quickest way to meet.`
                  : !s.ask
                    ? 'Nobody is selling right now. Make an offer and a seller can accept it instantly.'
                    : 'No offers yet. Yours would be the first.'}
              </p>
              <div className="actions desk-only" style={{ marginTop: 16 }}>
                {buttons}
              </div>
              {s.ask && <AlertRow s={s} flash={flash} />}

              <Tabs value={tab} onChange={setTab} />
              <div className="tabpanel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
                {tab === 'details' && (
                  <>
                    <div className="rows">
                      <div className="kv">
                        <span>The card</span>
                        <span>{demo ? 'Demo token, no card behind it' : `One graded slab. ${s.vaulted} in the vault`}</span>
                      </div>
                      <div className="kv">
                        <span>Grade</span>
                        <span>{cardSub(s.name).split(' · ')[0]}, checked against the PSA registry</span>
                      </div>
                      {own > 0 && (
                        <div className="kv">
                          <span>You own {own}</span>
                          <span>
                            {paid !== undefined && s.bid ? (
                              <>
                                Last paid {usd(paid)}
                                <span className={`gain ${s.bid - paid >= 0 ? 'up' : 'down'}`}>{delta(s.bid - paid)} if sold at the top offer (estimate)</span>
                              </>
                            ) : s.bid ? (
                              `Estimated ${usd(s.bid * own)} at the top offer`
                            ) : (
                              'No offers to value it against'
                            )}
                          </span>
                        </div>
                      )}
                      <div className="kv">
                        <span>Want it in hand?</span>
                        <span>{own > 0 ? <a className="u" href={`#/redeem/${sku}`}>Request the slab</a> : 'Own one, then request it'}</span>
                      </div>
                    </div>
                    <FoundingCollectors market={s.market} me={me} />
                    {orders.length > 0 && account && <OpenOrders orders={orders} s={s} account={account} done={() => (refresh(), refreshOrders(), refreshPort())} />}
                  </>
                )}
                {tab === 'book' && <OrderBook book={book} chain={net.chain.name} />}
                {tab === 'sales' && <SalesHistory fills={fills} source={hist?.source} loading={!hist} />}
              </div>
            </>
          )}

          {live && (
            <div className="sticky-bar mobile-only" style={{ marginTop: 24 }}>
              <div>{buttons}</div>
            </div>
          )}
          <div style={{ height: 96 }} className="mobile-only" />
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

/** What is on the book right now: asks lowest first, offers highest first. */
function OrderBook({ book, chain }: { book: { bids: Level[]; asks: Level[] }; chain: string }) {
  const asks = [...book.asks].sort((a, b) => a.price - b.price)
  const bids = [...book.bids].sort((a, b) => b.price - a.price)
  if (!asks.length && !bids.length) return <Empty title="The book is empty" detail="Nobody has posted an ask or an offer yet." />
  return (
    <>
      <div className="rows">
        <div className="kv"><span className="cap">Asks (for sale)</span><span className="cap">Price</span></div>
        {asks.length ? asks.map((l, i) => <div className="kv" key={'a' + i}><span>{l.size} {l.size === 1 ? 'copy' : 'copies'}</span><span>{usd(l.price)}</span></div>) : <div className="kv"><span>No asks</span><span>—</span></div>}
        <div className="kv"><span className="cap">Offers (wanted)</span><span className="cap">Price</span></div>
        {bids.length ? bids.map((l, i) => <div className="kv" key={'b' + i}><span>{l.size} {l.size === 1 ? 'copy' : 'copies'}</span><span>{usd(l.price)}</span></div>) : <div className="kv"><span>No offers</span><span>—</span></div>}
      </div>
      <p className="source">Source: the order book contract on {chain}, read live.</p>
    </>
  )
}

const RANGES = [['1M', 30], ['3M', 90], ['1Y', 365], ['All', 0]] as const
type RangeKey = (typeof RANGES)[number][0]

/** Sales over a chosen range, a plain chart with a labelled last-sale marker, and the source and range in words. */
function SalesHistory({ fills, source, loading }: { fills: Fill[]; source?: 'envio' | 'rpc'; loading: boolean }) {
  const [range, setRange] = useState<RangeKey>('All')
  if (loading) return <Skeleton h={190} r={12} />
  const days = RANGES.find((r) => r[0] === range)![1]
  const since = days ? Date.now() / 1000 - days * 86400 : 0
  const pts = fills.filter((f) => f.t >= since)
  const where = source === 'envio' ? 'Source: on-chain trades indexed by Envio' : 'Source: Monad RPC logs, which only reach back about 20 minutes. Older sales need the indexer'
  return (
    <>
      <div className="hist-head">
        <span className="fine">{pts.length} {pts.length === 1 ? 'sale' : 'sales'} in range</span>
        <span className="seg" role="group" aria-label="Range">
          {RANGES.map(([k]) => (
            <button key={k} aria-pressed={range === k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>
              {k}
            </button>
          ))}
        </span>
      </div>
      {pts.length > 1 ? <Chart fills={pts} /> : <Empty title={fills.length ? 'Not enough sales in this range' : 'No sales yet'} detail="A chart needs at least two sales. We don’t draw lines from guesses." />}
      <p className="source">{where}. Range: {range === 'All' ? 'all time' : `last ${range}`}.</p>
      {pts.length > 0 && (
        <div className="rows" style={{ marginTop: 8 }}>
          {[...pts].reverse().slice(0, 8).map((f, i) => (
            <div className="kv" key={i}>
              <span>{stamp(f.t)}</span>
              <span>{usd(f.price)}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function Chart({ fills }: { fills: Fill[] }) {
  const W = 340
  const H = 150
  const L = 46
  const B = 22
  const ps = fills.map((f) => f.price)
  const pad = Math.max(1, (Math.max(...ps) - Math.min(...ps)) * 0.2)
  const lo = Math.min(...ps) - pad
  const hi = Math.max(...ps) + pad
  const t0 = fills[0].t
  const span = Math.max(60, fills.at(-1)!.t - t0)
  const x = (t: number) => L + ((t - t0) / span) * (W - L - 8)
  const y = (p: number) => 8 + (1 - (p - lo) / (hi - lo)) * (H - B - 12)
  // Step line: each price holds until the next sale.
  const d = fills.map((f, i) => (i ? `H${x(f.t).toFixed(1)}V${y(f.price).toFixed(1)}` : `M${x(f.t).toFixed(1)},${y(f.price).toFixed(1)}`)).join('')
  const last = fills.at(-1)!
  const day = (t: number) => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <div className="hist">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Sale prices from ${usd(ps[0])} to ${usd(last.price)}, last sale ${usd(last.price)}`}>
        {[hi, (hi + lo) / 2, lo].map((v, i) => (
          <g key={i}>
            <line className="grid" x1={L} x2={W - 8} y1={y(v)} y2={y(v)} />
            <text className="axis" x={L - 6} y={y(v) + 3} textAnchor="end">{usd(Math.round(v))}</text>
          </g>
        ))}
        <text className="axis" x={L} y={H - 6}>{day(t0)}</text>
        <text className="axis" x={W - 8} y={H - 6} textAnchor="end">{day(last.t)}</text>
        <path className="line" d={d} />
        <circle className="last" cx={x(last.t)} cy={y(last.price)} r="4" />
        <text className="tag" x={Math.min(x(last.t), W - 70)} y={Math.max(y(last.price) - 9, 12)}>Last sale {usd(last.price)}</text>
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
