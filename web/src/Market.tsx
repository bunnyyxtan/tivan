import { useState } from 'react'
import { catalogOf, categories, categoryOf, net } from './config'
import { hasMarket, loadSkus, type Sku } from './chain'
import { usePortfolio } from './portfolio'
import { ActivityFeed } from './Feed'
import { CashPill, type Acct } from './App'
import { CardImage, usePrefs } from './fx'
import { Seg, Select } from './controls'
import { IconClose, IconGrid, IconList } from './icons'
import { Empty, ErrorNote, ItemCardSkeleton, RowSkeleton } from './States'
import { Header, Slab, cardSub, cardTitle, parseName, usePoll, useWatch, usd } from './ui'

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

/** Front and slab views of one card. Zoom follows the pointer, or the arrow keys once switched on with Z or the button. */
export function Viewer({ s, onInspect }: { s: { name: string; sku: string }; onInspect?: () => void }) {
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
        {onInspect && (
          <button className="mini" onClick={onInspect}>
            Inspect
          </button>
        )}
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
