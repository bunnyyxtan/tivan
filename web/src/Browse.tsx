import { useRef, useState, type ReactNode } from 'react'
import { catalogOf, categories, categoryOf, net } from './config'
import { hasMarket, loadSkus, type Sku } from './chain'
import { usePortfolio } from './portfolio'
import type { Acct } from './App'
import { Breadcrumbs, ChangeText, CompareTray, DataTable, PriceBlock, Shelf, TableSkeleton, ago, useCompare, useSales, type Change, type Col } from './desk'
import { setQuery, useQuery, useRestoreScroll, useWide } from './route'
import { Empty, ErrorNote, ItemCardSkeleton, Skeleton } from './States'
import { ItemCard, askText, gradeOf, lastText, offerText } from './Market'
import { IconClose, IconGrid, IconList } from './icons'
import { Opt, RangeDual, Seg, Select } from './controls'
import { pct } from './format'
import { Slab, cardSub, cardTitle, parseName, usePoll, useWatch, usd } from './ui'

// ===================================================================== filters, kept in the URL
type F = { q: string; cat: string; set: string; gmin?: number; gmax?: number; pmin?: number; pmax?: number; sale: boolean; sort: string; view: 'grid' | 'table' }
const num = (v: string | null) => (v !== null && v !== '' && !isNaN(+v) ? +v : undefined)
const readF = (sp: URLSearchParams): F => ({
  q: sp.get('q') ?? '',
  cat: sp.get('cat') ?? '',
  set: sp.get('set') ?? '',
  gmin: num(sp.get('gmin')),
  gmax: num(sp.get('gmax')),
  pmin: num(sp.get('pmin')),
  pmax: num(sp.get('pmax')),
  sale: sp.get('sale') === '1',
  sort: sp.get('sort') ?? '',
  view: sp.get('view') === 'table' ? 'table' : 'grid',
})
const price = (s: Sku) => s.ask ?? s.bid
const spreadOf = (s: Sku) => (s.ask && s.bid ? (s.ask - s.bid) / s.ask : undefined)
const RESET = { q: '', cat: '', set: '', gmin: '', gmax: '', pmin: '', pmax: '', sale: '' }

function filtered(all: Sku[], f: F, watch: string[]) {
  const q = f.q.trim().toLowerCase()
  return all.filter((s) => {
    const c = catalogOf(s.name)
    if (q && !`${s.name} ${c?.set ?? ''}`.toLowerCase().includes(q)) return false
    if (f.cat === 'Watching' ? !watch.includes(s.sku) : f.cat && categoryOf(s.name) !== f.cat) return false
    if (f.set && c?.set !== f.set) return false
    const g = gradeOf(s)
    if ((f.gmin !== undefined && !(g >= f.gmin)) || (f.gmax !== undefined && !(g <= f.gmax))) return false
    const p = price(s)
    if (f.pmin !== undefined || f.pmax !== undefined) {
      if (p === undefined) return false
      if ((f.pmin !== undefined && p < f.pmin) || (f.pmax !== undefined && p > f.pmax)) return false
    }
    return !f.sale || !!s.ask
  })
}

function sorted(list: Sku[], sort: string, change: Map<string, Change>) {
  if (!sort) return list
  const desc = sort.startsWith('-')
  const k = sort.replace('-', '')
  const val = (s: Sku): number | string | undefined =>
    k === 'name' ? cardTitle(s.name) : k === 'grade' ? gradeOf(s) : k === 'ask' ? s.ask : k === 'bid' ? s.bid : k === 'last' ? s.last : k === 'vault' ? s.vaulted : k === 'spread' ? spreadOf(s) : k === 'change' ? change.get(s.sku.toLowerCase())?.pct : undefined
  return [...list].sort((a, b) => {
    const x = val(a)
    const y = val(b)
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1 // missing values always last
    const d = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)
    return desc ? -d : d
  })
}

const SORTS: [string, string][] = [['', 'Default'], ['ask', 'Ask, low to high'], ['-ask', 'Ask, high to low'], ['-bid', 'Best offer, high to low'], ['-last', 'Last sale, high to low'], ['-change', 'Biggest change'], ['-spread', 'Widest spread'], ['-grade', 'Grade, high to low'], ['name', 'Name, A to Z']]
const money = (n: number) => usd(n)

function chips(f: F) {
  const gl = f.gmin !== undefined && f.gmax !== undefined ? `PSA ${f.gmin} to ${f.gmax}` : f.gmin !== undefined ? `PSA ${f.gmin} and up` : f.gmax !== undefined ? `Up to PSA ${f.gmax}` : ''
  const pl = f.pmin !== undefined && f.pmax !== undefined ? `${money(f.pmin)} to ${money(f.pmax)}` : f.pmin !== undefined ? `From ${money(f.pmin)}` : f.pmax !== undefined ? `Up to ${money(f.pmax)}` : ''
  return [
    f.q.trim() && { k: 'q', label: `“${f.q.trim()}”`, off: { q: '' } },
    f.cat && { k: 'c', label: f.cat === 'Watching' ? 'Watchlist' : f.cat, off: { cat: '' } },
    f.set && { k: 's', label: f.set, off: { set: '' } },
    gl && { k: 'g', label: gl, off: { gmin: '', gmax: '' } },
    pl && { k: 'p', label: pl, off: { pmin: '', pmax: '' } },
    f.sale && { k: 'f', label: 'For sale only', off: { sale: '' } },
  ].filter(Boolean) as unknown as { k: string; label: string; off: Record<string, string> }[]
}

// ===================================================================== filter rail
function Rail({ all, f, sp, watch }: { all: Sku[]; f: F; sp: URLSearchParams; watch: string[] }) {
  const prices = all.map(price).filter((p): p is number => !!p)
  const lo = prices.length ? Math.floor(Math.min(...prices)) : 0
  const hi = prices.length ? Math.ceil(Math.max(...prices)) : 0
  const step = Math.max(1, Math.round((hi - lo) / 200))
  const sets = [...new Set(all.map((s) => catalogOf(s.name)?.set).filter(Boolean) as string[])]
  const cats: [string, string, number | undefined][] = [['', 'All categories', all.length], ['Watching', 'Watchlist', all.filter((s) => watch.includes(s.sku)).length], ...categories.map((c) => [c, c, all.filter((s) => categoryOf(s.name) === c).length] as [string, string, number])]
  const grades = Array.from({ length: 10 }, (_, i) => String(10 - i))
  const radio = (name: 'cat' | 'set', value: string, label: string, n?: number) => (
    <Opt key={value} type="radio" name={name} checked={(name === 'cat' ? f.cat : f.set) === value} onChange={() => setQuery({ [name]: value })} label={label} count={n} />
  )
  return (
    <div className="rail-body">
      <fieldset>
        <legend>Category</legend>
        {cats.map(([v, l, n]) => radio('cat', v, l, n))}
      </fieldset>
      <fieldset>
        <legend>Grade, PSA</legend>
        <div className="pair">
          {(['gmin', 'gmax'] as const).map((k) => (
            <div key={k} className="lab">
              {k === 'gmin' ? 'Lowest' : 'Highest'}
              <Select
                label={k === 'gmin' ? 'Lowest grade' : 'Highest grade'}
                value={sp.get(k) ?? ''}
                options={[{ value: '', label: 'Any' }, ...(k === 'gmin' ? [...grades].reverse() : grades).map((g) => ({ value: g, label: g }))]}
                onChange={(v) => {
                  const other = k === 'gmin' ? f.gmax : f.gmin
                  const clash = v && other !== undefined && (k === 'gmin' ? +v > other : +v < other)
                  setQuery({ [k]: v, ...(clash ? { [k === 'gmin' ? 'gmax' : 'gmin']: v } : {}) })
                }}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Price</legend>
        <p className="fine">The ask, or the best offer where no one is selling.</p>
        {hi > lo && <RangeDual name="price" min={lo} max={hi} step={step} lo={f.pmin} hi={f.pmax} format={money} onChange={(l, h) => setQuery({ pmin: l === undefined ? '' : String(l), pmax: h === undefined ? '' : String(h) })} />}
      </fieldset>
      <fieldset>
        <legend>Set and year</legend>
        {radio('set', '', 'Any set')}
        {sets.map((s) => radio('set', s, s, all.filter((x) => catalogOf(x.name)?.set === s).length))}
      </fieldset>
      <Opt type="checkbox" checked={f.sale} onChange={(c) => setQuery({ sale: c ? '1' : '' })} label="For sale only" />
      <p className="fine">Every card here is graded by PSA and held in the vault, so grading company and condition are not filters.</p>
      <button className="ghost line" onClick={() => setQuery(RESET)}>
        Reset filters
      </button>
    </div>
  )
}

// ===================================================================== browse
export function Browse({ account }: { account: Acct }) {
  const wide = useWide()
  const sp = useQuery()
  const f = readF(sp)
  const { data, error, refresh } = usePoll(loadSkus, 8000, [])
  const sales = useSales()
  const { data: port } = usePortfolio(account?.address)
  const watch = useWatch()
  const cmp = useCompare()
  const [drawer, setDrawer] = useState(false)
  const dlg = useRef<HTMLDialogElement>(null)
  useRestoreScroll(!!data)
  const all = data ?? []
  const list = sorted(filtered(all, f, watch.list), f.sort, sales.change)
  const active = chips(f)
  const tag = (s: Sku) => {
    const o = port?.holdings.find((h) => h.s.sku === s.sku)
    return o && o.count > 0 ? `You own ${o.count}${o.listed ? ' · listed' : ''}` : watch.list.includes(s.sku) ? 'Watching' : ''
  }
  const onSort = (k: string) => setQuery({ sort: f.sort === k ? '-' + k : f.sort === '-' + k ? k : ['grade', 'bid', 'last', 'change', 'vault'].includes(k) ? '-' + k : k })
  const toggleCmp = (e: React.KeyboardEvent, s: Sku) => {
    if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey && !e.altKey) (e.preventDefault(), cmp.toggle(s.sku))
  }
  const cmpBtn = (s: Sku, tab: 0 | -1 = 0) => (
    <button className={`mini ${cmp.has(s.sku) ? 'on' : ''}`} tabIndex={tab} aria-pressed={cmp.has(s.sku)} disabled={!cmp.has(s.sku) && cmp.full} title={!cmp.has(s.sku) && cmp.full ? 'Compare holds four cards' : undefined} onClick={() => cmp.toggle(s.sku)}>
      {cmp.has(s.sku) ? 'In Compare' : 'Compare'}
    </button>
  )
  const cols: Col<Sku>[] = [
    {
      key: 'card',
      label: 'Card',
      sort: 'name',
      cell: (s, tab) => (
        <a className="tcard" href={`#/card/${s.sku}`} tabIndex={tab}>
          <Slab name={s.name} size="xs" vt={`card-${s.sku}`} />
          <span>
            <b>{cardTitle(s.name)}</b>
            <small>
              {parseName(s.name).demo ? 'DEMO · ' : ''}
              {catalogOf(s.name)?.set.replace(' · ', ' ')}
              {tag(s) ? ` · ${tag(s)}` : ''}
            </small>
          </span>
        </a>
      ),
    },
    { key: 'grade', label: 'Grade', sort: 'grade', cell: (s) => `${parseName(s.name).grader} ${parseName(s.name).grade}` },
    { key: 'ask', label: 'Ask', right: true, sort: 'ask', cell: (s) => askText(s, hasMarket(s)) },
    { key: 'bid', label: 'Best offer', right: true, sort: 'bid', cell: (s) => offerText(s, hasMarket(s)) },
    { key: 'last', label: 'Last sale', right: true, sort: 'last', cell: (s) => lastText(s) },
    { key: 'change', label: 'Change', right: true, sort: 'change', cell: (s) => <ChangeText c={sales.change.get(s.sku.toLowerCase())} /> },
    { key: 'vault', label: 'In vault', right: true, sort: 'vault', cell: (s) => s.vaulted },
    {
      key: 'act',
      label: 'Actions',
      right: true,
      cell: (s, tab) => (
        <span className="row-actions">
          <button className={`mini ${watch.list.includes(s.sku) ? 'on' : ''}`} tabIndex={tab} aria-pressed={watch.list.includes(s.sku)} onClick={() => watch.toggle(s.sku)}>
            {watch.list.includes(s.sku) ? 'Watching' : 'Watch'}
          </button>
          {cmpBtn(s, tab)}
        </span>
      ),
    },
  ]
  const toolbar = (
    <div className="toolbar">
      <span role="status" className="count-line">
        {data ? `${list.length} of ${all.length} ${all.length === 1 ? 'card' : 'cards'}` : 'Loading cards'}
      </span>
      {!wide && (
        <button className="ghost line" onClick={() => (setDrawer(true), dlg.current?.showModal())}>
          Filters{active.length ? ` (${active.length})` : ''}
        </button>
      )}
      <Select
        label="Sort"
        className="sort"
        value={f.sort}
        onChange={(v) => setQuery({ sort: v })}
        options={[...SORTS.map(([v, l]) => ({ value: v, label: `Sort: ${l}` })), ...(f.sort && !SORTS.some((x) => x[0] === f.sort) ? [{ value: f.sort, label: `Sort: ${f.sort.replace('-', '')} column` }] : [])]}
      />
      <Seg
        label="View"
        value={f.view}
        onChange={(v) => setQuery({ view: v === 'grid' ? '' : v })}
        options={[
          { value: 'grid', text: 'Grid view', label: (<><IconGrid size={16} />Grid</>) },
          { value: 'table', text: 'Table view', label: (<><IconList size={16} />Table</>) },
        ]}
      />
    </div>
  )
  const results: ReactNode = !net.vault ? (
    <Empty title={`Markets open on ${net.chain.name} soon`} />
  ) : error && !data ? (
    <ErrorNote what="Couldn’t load the markets." why={error} next="Check your connection, then try again." onRetry={refresh} />
  ) : !data ? (
    f.view === 'grid' ? (
      <div className="item-grid browse-grid" aria-hidden>
        {Array.from({ length: 10 }, (_, i) => (
          <ItemCardSkeleton key={i} />
        ))}
      </div>
    ) : (
      <TableSkeleton cols={cols} />
    )
  ) : !list.length ? (
    <Empty
      title={f.q.trim() ? `No cards match “${f.q.trim()}”` : f.cat === 'Watching' ? 'Nothing on your watchlist yet' : 'No cards match these filters'}
      detail={active.length ? 'Your search and filters are still applied above. Reset them to see every card.' : 'There are no cards listed yet.'}
      action={
        <button className="ghost line" onClick={() => setQuery(RESET)}>
          Reset filters
        </button>
      }
    />
  ) : f.view === 'grid' ? (
    <div className="item-grid browse-grid">
      {list.map((s) => (
        <div className="item-wrap" key={s.sku} onKeyDown={(e) => toggleCmp(e, s)}>
          <ItemCard s={s} tag={tag(s)} />
          <span className="cmp-slot">{cmpBtn(s)}</span>
        </div>
      ))}
    </div>
  ) : (
    <DataTable cols={cols} rows={list} rowKey={(s) => s.sku} label="Cards" sort={f.sort} onSort={onSort} onOpen={(s) => (location.hash = `#/card/${s.sku}`)} onRowKey={toggleCmp} />
  )
  return (
    <>
      <Breadcrumbs items={[['Discover', '#/'], ['Browse', f.cat ? '#/browse' : undefined], ...(f.cat ? ([[f.cat === 'Watching' ? 'Watchlist' : f.cat]] as [string][]) : [])]} />
      <h1 className="page-h">{f.cat === 'Watching' ? 'Watchlist' : f.cat || 'Browse'}</h1>
      <div className="browse">
        {wide && (
          <aside className="rail" aria-label="Filters">
            <Rail all={all} f={f} sp={sp} watch={watch.list} />
          </aside>
        )}
        <section className="results" aria-label="Results">
          {toolbar}
          {active.length > 0 && (
            <div className="chips active" role="group" aria-label="Active filters">
              <span className="chips-label">Filtered by</span>
              {active.map((a) => (
                <button key={a.k} className="x" onClick={() => setQuery(a.off)} aria-label={`Remove filter ${a.label}`}>
                  {a.label}
                  <IconClose />
                </button>
              ))}
              <button className="ghost" onClick={() => setQuery(RESET)}>
                Clear all
              </button>
            </div>
          )}
          {error && data && <p className="notice">Showing the last prices that loaded. The latest refresh failed: {error}</p>}
          {data && !sales.fills?.length && list.length > 0 && <p className="source">No recorded sales to read yet, so Change shows a dash until a card has traded twice.</p>}
          {results}
        </section>
      </div>
      {!wide && (
        <dialog
          ref={dlg}
          className="drawer"
          aria-label="Filters"
          onClose={() => setDrawer(false)}
          onClick={(e) => e.target === dlg.current && dlg.current?.close()}
        >
          {drawer && (
            <>
              <div className="settings-head">
                <h2>Filters</h2>
                <button className="ghost line" onClick={() => dlg.current?.close()}>
                  Show {list.length} {list.length === 1 ? 'card' : 'cards'}
                </button>
              </div>
              <Rail all={all} f={f} sp={sp} watch={watch.list} />
            </>
          )}
        </dialog>
      )}
      <CompareTray names={(id) => (all.find((s) => s.sku === id) ? cardTitle(all.find((s) => s.sku === id)!.name) : undefined)} />
    </>
  )
}

// ===================================================================== discover
export function Discover({ account }: { account: Acct }) {
  const { data, error, refresh } = usePoll(loadSkus, 8000, [])
  const sales = useSales()
  const { data: port } = usePortfolio(account?.address)
  const watch = useWatch()
  useRestoreScroll(!!data)
  const all = data ?? []
  const tag = (s: Sku) => {
    const o = port?.holdings.find((h) => h.s.sku === s.sku)
    return o && o.count > 0 ? `You own ${o.count}` : watch.list.includes(s.sku) ? 'Watching' : ''
  }
  const forSale = all.filter((s) => s.ask)
  const feat = [...forSale].sort((a, b) => b.ask! - a.ask!)[0]
  const fc = feat && catalogOf(feat.name)
  const lastSale = sales.fills?.[0]
  const rows = categories.map((c) => [c, all.filter((s) => categoryOf(s.name) === c)] as const).filter(([, l]) => l.length)
  return (
    <>
      <header className="mast">
        {data ? (
          <h1>
            {all.length} graded {all.length === 1 ? 'card' : 'cards'}, {forSale.length} for sale
          </h1>
        ) : (
          <h1 aria-label="Loading the market">
            <Skeleton h={34} w={380} r={6} />
          </h1>
        )}
        {data && (
          <dl className="mast-stats">
            <div>
              <dt>Cards listed</dt>
              <dd>{all.length}</dd>
            </div>
            <div>
              <dt>In the vault</dt>
              <dd>{all.reduce((n, s) => n + s.vaulted, 0)}</dd>
            </div>
            <div>
              <dt>Sales recorded</dt>
              <dd>{sales.fills ? sales.fills.length : '—'}</dd>
            </div>
            <div>
              <dt>Latest sale</dt>
              <dd>{lastSale ? `${usd(lastSale.price)} · ${ago(lastSale.t)}` : '—'}</dd>
            </div>
          </dl>
        )}
      </header>
      {error && !data && <ErrorNote what="Couldn’t load the markets." why={error} next="Check your connection, then try again." onRetry={refresh} />}
      {!net.vault && <Empty title={`Markets open on ${net.chain.name} soon`} />}
      {!data && !error && net.vault && (
        <div className="feature" aria-hidden>
          <Skeleton h={470} w={340} r={12} />
          <div>
            <Skeleton h={40} w="60%" r={6} />
            <div style={{ marginTop: 16 }}>
              <Skeleton h={90} r={6} />
            </div>
          </div>
        </div>
      )}
      {feat && (
        <section className="feature" aria-label="Featured card">
          <a className="feature-art" href={`#/card/${feat.sku}`} aria-label={`${cardTitle(feat.name)}, open card`}>
            <Slab name={feat.name} size="xl" />
          </a>
          <div className="feature-body">
            <h2>{cardTitle(feat.name)}</h2>
            <p className="muted">{cardSub(feat.name)}</p>
            <PriceBlock
              large
              ask={{ value: feat.ask, note: 'Lowest listed price' }}
              bid={{ value: feat.bid, note: feat.bid ? 'Highest standing offer' : 'No offers' }}
              last={{ value: feat.last, note: feat.last ? 'Most recent sale' : 'No sale on record' }}
            />
            <p className="fine">
              Highest ask on the market. {feat.vaulted} in the vault{feat.ask && feat.bid ? `. The ask is ${pct((feat.ask - feat.bid) / feat.ask)} above the best offer` : ''}.
            </p>
            <div className="actions">
              <a className="btn" href={`#/card/${feat.sku}`}>
                View card
              </a>
              {fc && (
                <a className="ghost line" href={`#/browse?cat=${encodeURIComponent(fc.category)}`}>
                  Browse {fc.category}
                </a>
              )}
            </div>
          </div>
        </section>
      )}
      {data && (
        <>
          <Shelf title="Recent sales" href="#/browse?sort=-last">
            {!sales.fills ? (
              sales.error ? (
                <p className="fine">Recent sales could not be loaded. They return on the next refresh.</p>
              ) : (
                Array.from({ length: 4 }, (_, i) => <Skeleton key={i} h={88} w={260} r={12} />)
              )
            ) : !sales.fills.length ? (
              <Empty title="No sales recorded yet" detail="Sales appear here once cards trade and the price indexer has read them." />
            ) : (
              sales.fills.slice(0, 14).map((x, i) => (
                <a key={i} className="sale" href={`#/card/${x.sku}`}>
                  <Slab name={x.name} size="sm" />
                  <span>
                    <b>{cardTitle(x.name)}</b>
                    <small>{cardSub(x.name)}</small>
                    <em>
                      {usd(x.price)} · {ago(x.t)}
                    </em>
                  </span>
                </a>
              ))
            )}
          </Shelf>
          {all.length > 0 && (
            <Shelf title="Newly listed" href="#/browse">
              {[...all].reverse().slice(0, 12).map((s) => (
                <ItemCard key={s.sku} s={s} tag={tag(s)} vt={false} />
              ))}
            </Shelf>
          )}
          {rows.filter(([, l]) => l.length >= 6).map(([c, l]) => (
            <Shelf key={c} title={c} href={`#/browse?cat=${encodeURIComponent(c)}`}>
              {l.slice(0, 12).map((s) => (
                <ItemCard key={s.sku} s={s} tag={tag(s)} vt={false} />
              ))}
            </Shelf>
          ))}
          {/* a short set is shown as tiles, side by side, never as a sparse row */}
          <div className="tiles">
            {rows.filter(([, l]) => l.length < 6).map(([c, l]) => (
              <section key={c} className="tiles-set" aria-label={c}>
                <div className="shelf-head">
                  <h2>{c}</h2>
                  <a href={`#/browse?cat=${encodeURIComponent(c)}`}>View all</a>
                </div>
                <div className="tiles-grid">
                  {l.map((s) => (
                    <ItemCard key={s.sku} s={s} tag={tag(s)} vt={false} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  )
}

// ===================================================================== compare
const NA = <span className="na">Information unavailable</span>

export function Compare() {
  const sp = useQuery()
  const stored = useCompare()
  const { data, error, refresh } = usePoll(loadSkus, 8000, [])
  const sales = useSales()
  const [diff, setDiff] = useState(false)
  const ids = (sp.get('ids') ?? '').split(',').filter(Boolean)
  const cards = (ids.length ? ids : stored.ids).map((id) => data?.find((s) => s.sku === id)).filter((s): s is Sku => !!s)
  const drop = (sku: string) => {
    if (stored.has(sku)) stored.toggle(sku)
    setQuery({ ids: cards.filter((s) => s.sku !== sku).map((s) => s.sku).join(',') })
  }
  type Row = [string, (s: Sku) => string | undefined]
  const set = (s: Sku) => catalogOf(s.name)?.set.split(' · ')
  const rows: Row[] = [
    ['Grade', (s) => (parseName(s.name).grade ? `${parseName(s.name).grader} ${parseName(s.name).grade}` : undefined)],
    ['Set', (s) => set(s)?.[0]],
    ['Year', (s) => set(s)?.[1]],
    ['Category', (s) => (catalogOf(s.name) ? categoryOf(s.name) : undefined)],
    ['Ask', (s) => (s.ask ? usd(s.ask) : hasMarket(s) ? 'No sellers' : 'Opening soon')],
    ['Best offer', (s) => (s.bid ? usd(s.bid) : hasMarket(s) ? 'No offers' : undefined)],
    ['Last sale', (s) => (s.last ? usd(s.last) : undefined)],
    ['Change since previous sale', (s) => { const c = sales.change.get(s.sku.toLowerCase()); return c ? `${c.pct >= 0 ? '+' : '−'}${pct(Math.abs(c.pct))}` : undefined }],
    ['Spread, ask over best offer', (s) => (s.ask && s.bid ? `${usd(s.ask - s.bid)} (${pct((s.ask - s.bid) / s.ask)})` : undefined)],
    ['In the vault', (s) => String(s.vaulted)],
    ['Population', () => undefined],
  ]
  const shown = diff ? rows.filter(([, v]) => new Set(cards.map(v)).size > 1) : rows
  return (
    <>
      <Breadcrumbs items={[['Discover', '#/'], ['Browse', '#/browse'], ['Compare']]} />
      <h1 className="page-h">Compare</h1>
      {error && !data && <ErrorNote what="Couldn’t load the cards." why={error} next="Try again." onRetry={refresh} />}
      {!data && !error && <Skeleton h={320} r={12} />}
      {data && cards.length < 2 && (
        <Empty title="Pick at least two cards to compare" detail="Use Compare on any card in Browse. The tray keeps up to four." action={<a className="ghost line" href="#/browse">Back to Browse</a>} />
      )}
      {cards.length >= 2 && (
        <>
          <div className="toolbar">
            <span role="status" className="count-line">
              {cards.length} cards{diff ? `, ${shown.length} of ${rows.length} rows differ` : ''}
            </span>
            <Opt type="checkbox" checked={diff} onChange={setDiff} label="Show differences only" />
          </div>
          <div className="cmp-scroll" tabIndex={0} role="region" aria-label="Comparison. This area scrolls on its own">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr">Attribute</span>
                  </th>
                  {cards.map((s) => (
                    <th key={s.sku} scope="col">
                      <a href={`#/card/${s.sku}`}>
                        <Slab name={s.name} size="sm" />
                        <b>{cardTitle(s.name)}</b>
                      </a>
                      <button className="mini" aria-label={`Remove ${cardTitle(s.name)} from the comparison`} onClick={() => drop(s.sku)}>
                        Remove
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(([label, v]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {cards.map((s) => (
                      <td key={s.sku}>{v(s) ?? NA}</td>
                    ))}
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <th scope="row">Differences</th>
                    <td colSpan={cards.length}>These cards match on every row we have.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}
