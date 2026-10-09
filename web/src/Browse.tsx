import { useRef, useState, type ReactNode } from 'react'
import { catalogOf, categories, categoryOf, net } from './config'
import { hasMarket, loadSkus, tradedSince, type Sku } from './chain'
import { usePortfolio } from './portfolio'
import type { Acct } from './App'
import { Breadcrumbs, CompareTray, DataTable, TableSkeleton, ago, useCompare, useSales, type Col } from './desk'
import { Delta, Live, MarketTile, PageHead, Spark, Stat, lastSaleAt, pointsFor } from './kit'
import { cents, usdC } from './cardParts'
import { spread } from './logic/orders.ts'
import { centsToUnits, formatBps, formatUsd } from './logic/money.ts'
import { setQuery, useQuery, useRestoreScroll, useWide } from './route'
import { Empty, ErrorNote, ItemCardSkeleton, Skeleton } from './States'
import { askText, gradeOf, lastText, offerText } from './Market'
import { IconGrid, IconList, IconSearch, IconStar } from './icons'
import { Chip, Opt, RangeDual, Seg, Select } from './controls'
import { pct } from './format'
import { Slab, cardTitle, parseName, usePoll, useWatch, usd } from './ui'

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

function sorted(list: Sku[], sort: string) {
  if (!sort) return list
  const desc = sort.startsWith('-')
  const k = sort.replace('-', '')
  const val = (s: Sku): number | string | undefined =>
    k === 'name' ? cardTitle(s.name) : k === 'grade' ? gradeOf(s) : k === 'ask' ? s.ask : k === 'bid' ? s.bid : k === 'last' ? s.last : k === 'vault' ? s.vaulted : k === 'spread' ? spreadOf(s) : undefined
  return [...list].sort((a, b) => {
    const x = val(a)
    const y = val(b)
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1 // missing values always last
    const d = typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)
    return desc ? -d : d
  })
}

const SORTS: [string, string][] = [['', 'Default'], ['ask', 'Ask, low to high'], ['-ask', 'Ask, high to low'], ['-bid', 'Best offer, high to low'], ['-last', 'Last sale, high to low'], ['-spread', 'Widest spread'], ['-grade', 'Grade, high to low'], ['name', 'Name, A to Z']]
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

// ===================================================================== category bar
/** Category cards that filter what is below them: a fan of slabs, the count and the vault value. */
function CatBar({ all, value, onPick, watch }: { all: Sku[]; value: string; onPick: (k: string) => void; watch?: string[] }) {
  const groups: [string, string, Sku[]][] = [
    ['', 'All markets', all],
    ...(watch ? ([['Watching', 'Watchlist', all.filter((s) => watch.includes(s.sku))]] as [string, string, Sku[]][]) : []),
    ...categories.map((c) => [c, c, all.filter((s) => categoryOf(s.name) === c)] as [string, string, Sku[]]).filter(([, , l]) => l.length),
  ]
  return (
    <nav className="catbar" aria-label="Filter by category">
      {groups.map(([k, label, l]) => {
        const v = l.reduce((n, s) => (s.bid ? n + centsToUnits(cents(s.bid)) * BigInt(s.vaulted) : n), 0n)
        return (
          <button key={k || 'all'} className="catcard" aria-pressed={value === k} onClick={() => onPick(k)}>
            <span className="catcard-fan" aria-hidden>{l.length ? l.slice(0, 3).map((s) => <Slab key={s.sku} name={s.name} size="xs" />) : <span className="catcard-star"><IconStar /></span>}</span>
            <span className="catcard-text">
              <b>{label}</b>
              <small>{l.length} market{l.length === 1 ? '' : 's'}</small>
              <span className="catcard-v">{l.length ? formatUsd(v, { digits: 0 }) : 'Star a market'}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}

// ===================================================================== filter rail
function Rail({ all, f, sp }: { all: Sku[]; f: F; sp: URLSearchParams }) {
  const prices = all.map(price).filter((p): p is number => !!p)
  const lo = prices.length ? Math.floor(Math.min(...prices)) : 0
  const hi = prices.length ? Math.ceil(Math.max(...prices)) : 0
  const step = Math.max(1, Math.round((hi - lo) / 200))
  const sets = [...new Set(all.map((s) => catalogOf(s.name)?.set).filter(Boolean) as string[])]
  const grades = Array.from({ length: 10 }, (_, i) => String(10 - i))
  const radio = (name: 'cat' | 'set', value: string, label: string, n?: number) => (
    <Opt key={value} type="radio" name={name} checked={(name === 'cat' ? f.cat : f.set) === value} onChange={() => setQuery({ [name]: value })} label={label} count={n} />
  )
  return (
    <div className="rail-body">
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
  const { data: port } = usePortfolio(account?.address, true)
  const watch = useWatch()
  const sales = useSales()
  const cmp = useCompare()
  const [drawer, setDrawer] = useState(false)
  const dlg = useRef<HTMLDialogElement>(null)
  useRestoreScroll(!!data)
  const all = data ?? []
  const list = sorted(filtered(all, f, watch.list), f.sort)
  const active = chips(f)
  const tag = (s: Sku) => {
    const o = port?.holdings.find((h) => h.s.sku === s.sku)
    return o && o.count > 0 ? `You own ${o.count}${o.listed ? ' · listed' : ''}` : watch.list.includes(s.sku) ? 'Watching' : ''
  }
  const onSort = (k: string) => setQuery({ sort: f.sort === k ? '-' + k : f.sort === '-' + k ? k : ['grade', 'bid', 'last', 'spread', 'vault'].includes(k) ? '-' + k : k })
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
    { key: 'spread', label: 'Spread', right: true, sort: 'spread', cell: (s) => { const x = spread(s.ask ? cents(s.ask) : undefined, s.bid ? cents(s.bid) : undefined); return x ? formatBps(x.bps, { digits: 1 }) : <span className="na">—</span> } },
    { key: 'last', label: 'Last trade', right: true, sort: 'last', cell: (s) => lastText(s) },
    { key: 'chg', label: 'Change', right: true, cell: (s) => <Delta c={sales.change.get(s.sku.toLowerCase())} /> },
    { key: 'vault', label: 'Supply', right: true, sort: 'vault', cell: (s) => s.vaulted },
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
      <label className="field toolbar-q">
        <IconSearch />
        <input value={f.q} onChange={(e) => setQuery({ q: e.target.value })} placeholder="Filter by card or set" aria-label="Filter by card or set" />
      </label>
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
          <MarketTile s={s} c={sales.change.get(s.sku.toLowerCase())} pts={pointsFor(sales.fills, s.sku)} tag={tag(s)} at={lastSaleAt(sales.fills, s.sku)} />
          <span className="cmp-slot">{cmpBtn(s)}</span>
        </div>
      ))}
    </div>
  ) : (
    <DataTable cols={cols} rows={list} rowKey={(s) => s.sku} label="Cards" sort={f.sort} onSort={onSort} onOpen={(s) => (location.hash = `#/card/${s.sku}`)} onRowKey={toggleCmp} />
  )
  return (
    <>
      <PageHead
        title={f.cat === 'Watching' ? 'Watchlist' : f.cat || 'Browse'}
        sub={data ? `${all.length} graded cards, each with its own order book` : 'Reading the catalogue'}
        crumbs={f.cat ? <Breadcrumbs items={[['Browse', '#/browse'], [f.cat === 'Watching' ? 'Watchlist' : f.cat]]} /> : undefined}
      />
      {data && <CatBar all={all} value={f.cat} watch={watch.list} onPick={(k) => setQuery({ cat: k })} />}
      <div className="browse">
        {wide && (
          <aside className="rail" aria-label="Filters">
            <Rail all={all} f={f} sp={sp} />
          </aside>
        )}
        <section className="results" aria-label="Results">
          {toolbar}
          {active.length > 0 && (
            <div className="chips active" role="group" aria-label="Active filters">
              <span className="chips-label">Filtered by</span>
              {active.map((a) => (
                <Chip key={a.k} label={a.label} onRemove={() => setQuery(a.off)}>
                  {a.label}
                </Chip>
              ))}
              <button className="ghost" onClick={() => setQuery(RESET)}>
                Clear all
              </button>
            </div>
          )}
          {error && data && <p className="notice">Showing the last prices that loaded. The latest refresh failed: {error}</p>}
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
              <Rail all={all} f={f} sp={sp} />
            </>
          )}
        </dialog>
      )}
      <CompareTray names={(id) => (all.find((s) => s.sku === id) ? cardTitle(all.find((s) => s.sku === id)!.name) : undefined)} />
    </>
  )
}

// ===================================================================== markets (the home dashboard)
type View = 'all' | 'trending' | 'movers' | 'recent' | 'watch'
const VIEWS: [View, string][] = [['all', 'All'], ['trending', 'Trending'], ['movers', 'Top movers'], ['recent', 'Recently traded'], ['watch', 'Watchlist']]

export function Discover({ account }: { account: Acct }) {
  const { data, error, refresh } = usePoll(async () => ({ skus: await loadSkus(), at: Date.now() }), 8000, [])
  const sales = useSales()
  const { data: port } = usePortfolio(account?.address, true)
  const watch = useWatch()
  const sp = useQuery()
  const view = (VIEWS.find((v) => v[0] === sp.get('v'))?.[0] ?? 'all') as View
  const cat = sp.get('cat') ?? ''
  useRestoreScroll(!!data)
  const all = data?.skus ?? []
  const fills = sales.fills
  const chg = (s: Sku) => sales.change.get(s.sku.toLowerCase())
  const owned = (s: Sku) => port?.holdings.find((h) => h.s.sku === s.sku)?.count ?? 0
  const count = new Map<string, number>()
  for (const f of fills ?? []) count.set(f.sku.toLowerCase(), (count.get(f.sku.toLowerCase()) ?? 0) + 1)
  // Every figure is computed from the markets and trades on screen, with the time they were read.
  const spreads = all.map((s) => spread(s.ask ? cents(s.ask) : undefined, s.bid ? cents(s.bid) : undefined)).filter((x): x is NonNullable<typeof x> => !!x).map((x) => x.bps).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const median = spreads.length ? (spreads.length % 2 ? spreads[(spreads.length - 1) / 2] : (spreads[spreads.length / 2 - 1] + spreads[spreads.length / 2]) / 2n) : undefined
  const vaultValue = all.reduce((n, s) => (s.bid ? n + centsToUnits(cents(s.bid)) * BigInt(s.vaulted) : n), 0n)
  const slabs = all.reduce((n, s) => n + s.vaulted, 0)
  const monthAgo = Date.now() / 1000 - 30 * 86_400
  const month = (fills ?? []).filter((x) => x.t >= monthAgo)
  const monthVol = month.reduce((n, x) => n + cents(x.price), 0n)
  const capped = (fills?.length ?? 0) >= 300
  // Exact 30-day totals from the indexer's daily candles; the recent-sales estimate above is the fallback.
  const days = usePoll(() => tradedSince(Math.floor(Date.now() / 86_400_000) - 29), 60000, []).data
  const lastSale = fills?.[0]
  const latestPer = (fills ?? []).filter((x, i, a) => a.findIndex((y) => y.sku.toLowerCase() === x.sku.toLowerCase()) === i).slice(0, 6)
  const movers = all.filter((s) => chg(s)).sort((a, b) => Math.abs(chg(b)!.pct) - Math.abs(chg(a)!.pct)).slice(0, 5)
  const inCat = all.filter((s) => !cat || categoryOf(s.name) === cat)
  const rows =
    view === 'trending' ? [...inCat].sort((a, b) => (count.get(b.sku.toLowerCase()) ?? 0) - (count.get(a.sku.toLowerCase()) ?? 0) || (b.ask ?? 0) - (a.ask ?? 0))
    : view === 'movers' ? inCat.filter((s) => chg(s)).sort((a, b) => Math.abs(chg(b)!.pct) - Math.abs(chg(a)!.pct))
    : view === 'recent' ? inCat.filter((s) => lastSaleAt(fills, s.sku)).sort((a, b) => lastSaleAt(fills, b.sku)! - lastSaleAt(fills, a.sku)!)
    : view === 'watch' ? inCat.filter((s) => watch.list.includes(s.sku))
    : inCat
  const cols: Col<Sku>[] = [
    {
      key: 'w',
      label: 'Watch',
      cell: (s, tab) => (
        <button className={`star ${watch.list.includes(s.sku) ? 'on' : ''}`} tabIndex={tab} aria-pressed={watch.list.includes(s.sku)} aria-label={`Watch ${cardTitle(s.name)}`} onClick={() => watch.toggle(s.sku)}>
          <IconStar />
        </button>
      ),
    },
    {
      key: 'card',
      label: 'Market',
      cell: (s, tab) => (
        <a className="tcard" href={`#/card/${s.sku}`} tabIndex={tab}>
          <Slab name={s.name} size="xs" />
          <span>
            <b>{cardTitle(s.name)}</b>
            <small>
              {parseName(s.name).grader} {parseName(s.name).grade} · {catalogOf(s.name)?.set.replace(' · ', ' ')}
              {owned(s) > 0 ? <em className="own"> · You own {owned(s)}</em> : null}
            </small>
          </span>
        </a>
      ),
    },
    { key: 'ask', label: 'Ask', right: true, cell: (s) => (s.ask ? <b className="fig">{usdC(cents(s.ask))}</b> : <span className="na">No sellers</span>) },
    { key: 'bid', label: 'Best offer', right: true, cell: (s) => (s.bid ? <span className="fig">{usdC(cents(s.bid))}</span> : <span className="na">No offers</span>) },
    { key: 'last', label: 'Last sale', right: true, cell: (s) => (s.last ? <span className="fig">{usdC(cents(s.last))}</span> : <span className="na">None yet</span>) },
    { key: 'chg', label: 'Change', right: true, cell: (s) => <Delta c={chg(s)} /> },
    { key: 'trend', label: 'Recent sales', right: true, cell: (s) => <Spark pts={pointsFor(fills, s.sku)} tone={chg(s) ? (chg(s)!.pct >= 0 ? 'up' : 'down') : undefined} /> },
    { key: 'vault', label: 'Vaulted', right: true, cell: (s) => <span className="fig">{s.vaulted}</span> },
    {
      key: 'go',
      label: 'Trade',
      right: true,
      cell: (s, tab) => (
        <a className="btn xs" tabIndex={tab} href={`#/card/${s.sku}`}>
          {s.ask ? 'Buy' : 'Offer'}
        </a>
      ),
    },
  ]
  return (
    <div className="dash">
      <PageHead title="Markets" sub={data ? <>{all.length} markets · {slabs} slabs in the vault · <Live at={data.at} /></> : 'Reading the markets'}>
        <a className="ghost line md" href="#/browse">Browse all</a>
        <a className="btn md" href="#/sell">Sell a card</a>
      </PageHead>

      {error && !data && <ErrorNote what="Couldn’t load the markets." why={error} next="Check your connection, then try again." onRetry={refresh} />}
      {!net.vault && <Empty title={`Markets open on ${net.chain.name} soon`} />}

      <section className="stats4" aria-label="Market summary">
        <Stat label="Vault value" value={data ? formatUsd(vaultValue, { digits: 0 }) : <Skeleton h={28} w={140} r={6} />} note="Each slab at its best offer" />
        <Stat label="Traded, 30 days" value={days ? usdC(days.cents) : fills ? usdC(monthVol) : '—'} note={days ? `${days.trades.toLocaleString('en-US')} sales` : fills ? `${capped ? 'At least ' : ''}${month.length} sales` : sales.error ? 'Needs the indexer' : ' '} />
        <Stat label="Median spread" value={median !== undefined ? formatBps(median, { digits: 1 }) : '—'} note="Gap from best offer to ask" />
        <Stat label="Last sale" value={lastSale ? usdC(cents(lastSale.price)) : '—'} note={lastSale ? `${cardTitle(lastSale.name)}, ${ago(lastSale.t)}` : ' '} />
      </section>

      {data && (
        <CatBar all={all} value={cat} onPick={(k) => setQuery({ cat: k })} />
      )}

      <div className="dash-grid">
        <section className="panel tpanel" aria-labelledby="mk-h">
          <div className="tpanel-head">
            <h2 id="mk-h" className="sr">All markets</h2>
            <div className="pills" role="tablist" aria-label="Show">
              {VIEWS.map(([v, l]) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setQuery({ v: v === 'all' ? '' : v })}>
                  {l}
                  {v === 'watch' && watch.list.length > 0 && <span className="count">{watch.list.length}</span>}
                </button>
              ))}
            </div>
          </div>
          {!data ? (
            <TableSkeleton cols={cols} rows={10} />
          ) : !rows.length ? (
            <Empty title={view === 'watch' ? 'Your watchlist is empty' : view === 'movers' ? 'No moves yet' : 'Nothing here yet'} detail={view === 'watch' ? 'Tap the star on any market to follow it here.' : 'Moves appear once a market has traded twice.'} />
          ) : (
            <div className="tscroll">
              <DataTable cols={cols} rows={rows} rowKey={(s) => s.sku} label="Markets" onOpen={(s) => (location.hash = `#/card/${s.sku}`)} />
            </div>
          )}
        </section>

        <aside className="dash-rail">
          <section className="panel" aria-labelledby="ls-h">
            <div className="panel-head"><h2 id="ls-h">Latest sales</h2><Live label="Live" /></div>
            {!fills ? (
              sales.error ? <p className="fine">Sales could not be loaded. They return on the next refresh.</p> : <Skeleton h={220} r={8} />
            ) : !latestPer.length ? (
              <p className="fine">No sales yet. They appear here the moment a card trades.</p>
            ) : (
              <ol className="feed">
                {latestPer.map((x) => (
                  <li key={`${x.sku}-${x.t}`}>
                    <a href={`#/card/${all.find((s) => s.sku.toLowerCase() === x.sku.toLowerCase())?.sku ?? x.sku}`}>
                      <Slab name={x.name} size="xs" />
                      <span className="feed-t"><b>{cardTitle(x.name)}</b><small>{parseName(x.name).grader} {parseName(x.name).grade} · {ago(x.t)}</small></span>
                      <span className="fig">{usdC(cents(x.price))}</span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="panel" aria-labelledby="mv-h">
            <div className="panel-head"><h2 id="mv-h">Biggest moves</h2><span className="fine">Last two sales</span></div>
            {!movers.length ? (
              <p className="fine">Moves appear once a market has traded twice.</p>
            ) : (
              <ol className="feed">
                {movers.map((s) => (
                  <li key={s.sku}>
                    <a href={`#/card/${s.sku}`}>
                      <Slab name={s.name} size="xs" />
                      <span className="feed-t"><b>{cardTitle(s.name)}</b><small>{usdC(cents(chg(s)!.prev))} to {usdC(cents(chg(s)!.last))}</small></span>
                      <Delta c={chg(s)} />
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

    </div>
  )
}

// ===================================================================== compare
const NA = <span className="na">Information unavailable</span>

export function Compare() {
  const sp = useQuery()
  const stored = useCompare()
  const { data, error, refresh } = usePoll(loadSkus, 8000, [])
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
    ['Spread, ask over best offer', (s) => (s.ask && s.bid ? `${usd(s.ask - s.bid)} (${pct((s.ask - s.bid) / s.ask)})` : undefined)],
    ['In the vault', (s) => String(s.vaulted)],
    ['Population', () => undefined],
  ]
  const shown = diff ? rows.filter(([, v]) => new Set(cards.map(v)).size > 1) : rows
  return (
    <>
      <PageHead title="Compare" sub="Up to four markets side by side" crumbs={<Breadcrumbs items={[['Browse', '#/browse'], ['Compare']]} />} />
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
