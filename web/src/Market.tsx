import { useState } from 'react'
import type { LocalAccount } from 'viem'
import { alertPrice, useAlerts } from './alerts'
import { brand, catalogOf, categories, categoryOf, net } from './config'
import { bookAbi, decodeL2, hasMarket, lastPaid, loadSkus, openOrders, pub, send, tradeHistory, type Fill, type Level, type Order, type Sku } from './chain'
import { usePortfolio } from './portfolio'
import { ActivityFeed, FoundingCollectors } from './Feed'
import { priceCard, shareCard } from './share'
import { CashPill, type Acct } from './App'
import { CardImage, usePrefs } from './fx'
import { useWide, WIDE } from './route'
import { Seg, Select } from './controls'
import { Breadcrumbs, Chart, PriceBlock, Shelf, Tabs, ago } from './desk'
import { IconClose, IconGrid, IconList } from './icons'
import { Empty, ErrorNote, ItemCardSkeleton, RowSkeleton, Skeleton } from './States'
import { pct, stamp } from './format'
import { Header, Roll, Slab, Steps, Toast, cardSub, cardTitle, delta, parseName, useFlow, usePoll, useWatch, usd } from './ui'

// ===================================================================== browse
type Sort = 'featured' | 'high' | 'low' | 'spread' | 'name'
type Grade = 'any' | '10' | '9' | 'lower'
const price = (s: Sku) => s.ask ?? s.bid ?? 0
const spreadOf = (s: Sku) => (s.ask && s.bid ? (s.ask - s.bid) / s.ask : undefined)
export const gradeOf = (s: Sku) => Number(parseName(s.name).grade)
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
        <Select
          label="Sort"
          className="grow"
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          options={[{ value: 'featured', label: 'Sort: Default' }, { value: 'high', label: 'Price, high to low' }, { value: 'low', label: 'Price, low to high' }, { value: 'spread', label: 'Biggest spread' }, { value: 'name', label: 'Name, A to Z' }]}
        />
        <Seg
          label="View"
          value={prefs.view}
          onChange={(v) => setPrefs({ view: v })}
          options={[{ value: 'grid', text: 'Grid view', label: <IconGrid size={16} /> }, { value: 'list', text: 'List view', label: <IconList size={16} /> }]}
        />
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

export const askText = (s: Sku, live: boolean) => (!live ? 'Opening soon' : s.ask ? usd(s.ask) : 'No sellers')
export const offerText = (s: Sku, live: boolean) => (!live ? '—' : s.bid ? usd(s.bid) : 'No offers')
export const lastText = (s: Sku) => (s.last ? usd(s.last) : '—')

/** The card anatomy used everywhere: media, title, grade line, then three labelled figures in fixed positions. */
export function ItemCard({ s, tag, vt = true }: { s: Sku; tag: string; vt?: boolean }) {
  const { demo } = parseName(s.name)
  const live = hasMarket(s)
  return (
    <a className="item-card" href={`#/card/${s.sku}`}>
      {tag && <span className="item-badge">{tag}</span>}
      <div className="item-media">
        <Slab name={s.name} size="md" vt={vt ? `card-${s.sku}` : undefined} />
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
        <div className="price-q">
          <b>{askText(s, live)}</b>
          <small>{s.bid ? `Best offer ${usd(s.bid)}` : 'No offers'}</small>
        </div>
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
type Tab = 'history' | 'details' | 'book' | 'sales'

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
  const wide = useWide()
  const [tab, setTab] = useState<Tab>(() => (matchMedia(WIDE).matches ? 'history' : 'details'))

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
  const deskButtons = (
    <>
      <a className="btn" href={s.ask ? `#/buy/${sku}` : `#/offer/${sku}`}>
        {s.ask ? `Buy for ${usd(s.ask)}` : 'Make an offer'}
      </a>
      {own > 0 ? (
        <a className="ghost line" href={`#/sell/${sku}`}>
          Sell
        </a>
      ) : s.ask ? (
        <a className="ghost line" href={`#/offer/${sku}`}>
          Make offer
        </a>
      ) : null}
    </>
  )
  const utility = (
    <span style={{ display: 'flex', gap: 8 }}>
      <button className="pill" onClick={share} aria-label="Share this price">
        Share
      </button>
      <button className={`pill ${watching ? 'on' : ''}`} aria-pressed={watching} onClick={() => flash(watch.toggle(sku) ? 'Added to Watching.' : 'Removed from Watching.')}>
        {watching ? 'Watching' : 'Watch'}
      </button>
    </span>
  )
  const t: Tab = wide ? tab : tab === 'history' ? 'sales' : tab
  const sale = lastFill ? { value: lastFill.price, note: stamp(lastFill.t) } : { value: s.last, note: s.last ? 'From the index' : 'No sales yet' }
  const catName = catalogOf(s.name)?.category
  const related = (all ?? []).filter((x) => x.sku !== sku && (catalogOf(x.name)?.title === catalogOf(s.name)?.title || catalogOf(x.name)?.set === catalogOf(s.name)?.set)).slice(0, 12)
  const tabsEl = live && (
    <>
      <Tabs
        label="Card information"
        value={t}
        onChange={setTab}
        tabs={(wide ? [['history', 'Price history'], ['book', 'Order book', book.asks.length + book.bids.length], ['sales', 'Sales history', fills.length], ['details', 'Details and population']] : [['details', 'Details'], ['book', 'Order book'], ['sales', 'Sales history']]) as [Tab, string, number?][]}
      />
      <div className="tabpanel" role="tabpanel" id={`panel-${t}`} aria-labelledby={`tab-${t}`}>
        {t === 'history' && <SalesHistory fills={fills} source={hist?.source} loading={!hist} rows={false} h={300} />}
        {t === 'details' && (
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
              {wide && (
                <div className="kv">
                  <span>Population</span>
                  <span className="na">Information unavailable</span>
                </div>
              )}
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
        {t === 'book' && (wide ? <BookTables book={book} chain={net.chain.name} /> : <OrderBook book={book} chain={net.chain.name} />)}
        {t === 'sales' && (wide ? <SalesTable fills={fills} source={hist?.source} loading={!hist} /> : <SalesHistory fills={fills} source={hist?.source} loading={!hist} />)}
      </div>
    </>
  )
  return (
    <>
      {wide ? (
        <Breadcrumbs items={[['Discover', '#/'], ['Browse', '#/browse'], ...(catName ? ([[catName, `#/browse?cat=${encodeURIComponent(catName)}`]] as [string, string][]) : []), [cardTitle(s.name)]]} />
      ) : (
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
      )}
      <div className="card-layout">
        <div className="card-hero">{wide ? <Viewer s={s} /> : <Slab name={s.name} size="lg" vt={`card-${s.sku}`} />}</div>
        <div>
          {wide ? (
            <div className="title-row">
              <h1>{cardTitle(s.name)}</h1>
              {utility}
            </div>
          ) : (
            <h1 style={{ fontSize: 32, overflowWrap: 'anywhere' }}>{cardTitle(s.name)}</h1>
          )}
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
              {wide ? (
                <PriceBlock ask={{ value: s.ask, note: s.ask ? `${askSize} for sale` : 'No sellers' }} bid={{ value: s.bid, note: s.bid ? `${book.bids.reduce((n, l) => n + l.size, 0)} wanted` : 'No offers' }} last={sale} />
              ) : (
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
              )}
              <p className="fine" style={{ marginTop: 10, fontSize: 14 }}>
                {gap !== undefined && s.ask
                  ? `Spread ${usd(gap)}, ${pct(gap / s.ask)} of the ask. An offer in between is the quickest way to meet.`
                  : !s.ask
                    ? 'Nobody is selling right now. Make an offer and a seller can accept it instantly.'
                    : 'No offers yet. Yours would be the first.'}
              </p>
              <div className="actions desk-only" style={{ marginTop: 16 }}>
                {deskButtons}
              </div>
              {s.ask && <AlertRow s={s} flash={flash} />}

              {!wide && tabsEl}
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
      {wide && live && (
        <section className="below">
          {tabsEl}
          {related.length > 0 && (
            <Shelf title="Related cards" href={catalogOf(s.name) ? `#/browse?set=${encodeURIComponent(catalogOf(s.name)!.set)}` : '#/browse'}>
              {related.map((x) => (
                <ItemCard key={x.sku} s={x} tag="" vt={false} />
              ))}
            </Shelf>
          )}
        </section>
      )}
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
function SalesHistory({ fills, source, loading, rows = true, h = 150 }: { fills: Fill[]; source?: 'envio' | 'rpc'; loading: boolean; rows?: boolean; h?: number }) {
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
        <Seg label="Range" value={range} onChange={setRange} options={RANGES.map(([k]) => ({ value: k, label: k }))} />
      </div>
      {pts.length > 1 ? <Chart pts={pts} h={h} label={`Sale prices from ${usd(pts[0].price)} to ${usd(pts.at(-1)!.price)}, last sale ${usd(pts.at(-1)!.price)}`} /> : <Empty title={fills.length ? 'Not enough sales in this range' : 'No sales yet'} detail="A chart needs at least two sales. We don’t draw lines from guesses." />}
      <p className="source">{where}. Range: {range === 'All' ? 'all time' : `last ${range}`}.</p>
      {rows && pts.length > 0 && (
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

/** Bids and asks side by side, same columns and row height: price, copies, and what that level is worth in dollars. */
function BookTables({ book, chain }: { book: { bids: Level[]; asks: Level[] }; chain: string }) {
  const asks = [...book.asks].sort((a, b) => a.price - b.price)
  const bids = [...book.bids].sort((a, b) => b.price - a.price)
  if (!asks.length && !bids.length) return <Empty title="The book is empty" detail="Nobody has posted an ask or an offer yet." />
  const side = (name: string, rows: Level[], none: string) => (
    <table className="booktable" aria-label={name}>
      <caption>{name}</caption>
      <thead>
        <tr>
          <th scope="col" className="num">Price</th>
          <th scope="col" className="num">Copies</th>
          <th scope="col" className="num">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? rows.map((l, i) => (
          <tr key={i}>
            <td className="num">{usd(l.price)}</td>
            <td className="num">{l.size}</td>
            <td className="num">{usd(l.price * l.size)}</td>
          </tr>
        )) : <tr><td colSpan={3} className="na">{none}</td></tr>}
      </tbody>
    </table>
  )
  return (
    <>
      <div className="book">
        {side('Offers (wanted), highest first', bids, 'No offers')}
        {side('Asks (for sale), lowest first', asks, 'No asks')}
      </div>
      <p className="source">Source: the order book contract on {chain}, read live. Total is price times copies.</p>
    </>
  )
}

/** Every recorded sale, newest first. */
function SalesTable({ fills, source, loading }: { fills: Fill[]; source?: 'envio' | 'rpc'; loading: boolean }) {
  if (loading) return <Skeleton h={190} r={12} />
  if (!fills.length) return <Empty title="No sales yet" detail="Sales appear here once this card trades." />
  return (
    <>
      <table className="booktable sales" aria-label="Sales history">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col" className="num">Price</th>
            <th scope="col" className="num">Copies</th>
            <th scope="col">Taker</th>
          </tr>
        </thead>
        <tbody>
          {[...fills].reverse().slice(0, 50).map((f, i) => (
            <tr key={i}>
              <td>{stamp(f.t)} <span className="muted">· {ago(f.t)}</span></td>
              <td className="num">{usd(f.price)}</td>
              <td className="num">{f.size}</td>
              <td>{f.takerBuy ? 'Bought' : 'Sold'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="source">{fills.length > 50 ? `Showing the latest 50 of ${fills.length}. ` : ''}{source === 'envio' ? 'Source: on-chain trades indexed by Envio.' : 'Source: Monad RPC logs, which only reach back about 20 minutes. Older sales need the indexer.'}</p>
    </>
  )
}

/** Front and slab views of one card. Zoom follows the pointer, or the arrow keys once switched on with Z or the button. */
export function Viewer({ s }: { s: { name: string; sku: string } }) {
  const [view, setView] = useState<'front' | 'slab'>('front')
  const [zoom, setZoom] = useState(false)
  const [at, setAt] = useState({ x: 50, y: 50 })
  const c = catalogOf(s.name)
  const name = cardTitle(s.name)
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoom) return
    const r = e.currentTarget.getBoundingClientRect()
    setAt({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
  }
  const key = (e: React.KeyboardEvent) => {
    const k = e.key
    if (k === 'z' || k === 'Z' || k === 'Enter') return (e.preventDefault(), setZoom(!zoom))
    if (!zoom || !k.startsWith('Arrow')) return
    e.preventDefault()
    setAt((p) => ({ x: Math.max(0, Math.min(100, p.x + (k === 'ArrowRight' ? 12 : k === 'ArrowLeft' ? -12 : 0))), y: Math.max(0, Math.min(100, p.y + (k === 'ArrowDown' ? 12 : k === 'ArrowUp' ? -12 : 0))) }))
  }
  return (
    <div className="viewer">
      <div className="thumbs" role="group" aria-label="Views">
        <button className={view === 'front' ? 'on' : ''} aria-pressed={view === 'front'} aria-label="Front of the card" onClick={() => setView('front')}>
          <CardImage src={c?.imageUrl} alt="" label={name} />
          <span>Front</span>
        </button>
        <button className={view === 'slab' ? 'on' : ''} aria-pressed={view === 'slab'} aria-label="Graded slab" onClick={() => (setView('slab'), setZoom(false))}>
          <Slab name={s.name} size="xs" />
          <span>Slab</span>
        </button>
        <button className={`mini ${zoom ? 'on' : ''}`} aria-pressed={zoom} disabled={view !== 'front'} onClick={() => setZoom(!zoom)}>
          Zoom
        </button>
      </div>
      <div className="stage">
        {view === 'slab' ? (
          <Slab name={s.name} size="xl" vt={`card-${s.sku}`} />
        ) : (
          <div className={`zoomer ${zoom ? 'on' : ''}`} tabIndex={0} role="group" aria-label={`${name}, front. Press Z to zoom, then use the arrow keys to move`} onPointerMove={move} onKeyDown={key} onClick={() => setZoom(!zoom)}>
            <div style={zoom ? { transformOrigin: `${at.x}% ${at.y}%`, transform: 'scale(2.4)' } : undefined}>
              <CardImage src={c?.imageUrl} alt={`${name}, ${cardSub(s.name)}`} label={name} />
            </div>
          </div>
        )}
        {c?.imageKind === 'reference' && <p className="source viewer-note">Reference image of this card, not a photograph of this slab.</p>}
      </div>
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
