import { useState, type ReactNode } from 'react'
import type { LocalAccount } from 'viem'
import { bookAbi, hasMarket, lastPaid, send, tradeHistory, type Fill, type Order, type Sku } from './chain'
import { categoryOf, indexerUrl } from './config'
import { usePortfolio } from './portfolio'
import { Breadcrumbs, Chart, DataTable, StatPill, Tabs, TableSkeleton, ago, type Col } from './desk'
import { setQuery, useQuery } from './route'
import { Empty, ErrorNote, Skeleton } from './States'
import { askText, lastText, offerText } from './Market'
import { pct, stamp } from './format'
import { Slab, Steps, cardSub, cardTitle, delta, useFlow, usePoll, useWatch, usd } from './ui'

const PERIODS = [['1M', 30], ['3M', 90], ['1Y', 365], ['All', 0]] as const
type Period = (typeof PERIODS)[number][0]

const CardCell = ({ s, tab, note }: { s: Sku; tab: 0 | -1; note?: string }) => (
  <a className="tcard" href={`#/card/${s.sku}`} tabIndex={tab}>
    <Slab name={s.name} size="xs" />
    <span>
      <b>{cardTitle(s.name)}</b>
      <small>
        {cardSub(s.name)}
        {note ? ` · ${note}` : ''}
      </small>
    </span>
  </a>
)

/** The value of what you hold on each past sale date: every held card at its last sale price so far. Starts once every card has sold at least once. */
function series(mine: { s: Sku; count: number }[], fills: Record<string, Fill[]>) {
  const evs = mine.flatMap((h) => (fills[h.s.sku] ?? []).map((f) => ({ sku: h.s.sku, t: f.t, p: f.price }))).sort((a, b) => a.t - b.t)
  const cur = new Map<string, number>()
  const out: { t: number; price: number }[] = []
  for (const e of evs) {
    cur.set(e.sku, e.p)
    if (cur.size === mine.length) out.push({ t: e.t, price: mine.reduce((n, h) => n + h.count * cur.get(h.s.sku)!, 0) })
  }
  return out
}

// ===================================================================== portfolio
export function Portfolio({ account }: { account: LocalAccount }) {
  const me = account.address
  const sp = useQuery()
  const period = (PERIODS.find((p) => p[0] === sp.get('p'))?.[0] ?? 'All') as Period
  const { data, error, totalCash, refresh } = usePortfolio(me, true)
  const [at, setAt] = useState<'bid' | 'ask'>('bid')
  const mine = (data?.holdings ?? []).filter((h) => h.count > 0)
  const key = mine.map((h) => h.s.sku).join()
  const { data: fills } = usePoll(async () => Object.fromEntries(await Promise.all(mine.map(async (h) => [h.s.sku, (await tradeHistory(h.s.market)).fills] as const))) as Record<string, Fill[]>, 30000, [key])
  const value = (s: Sku) => (at === 'bid' ? s.bid : (s.ask ?? s.bid))
  const basis = at === 'bid' ? 'best offer' : 'ask'
  const paid = (s: Sku) => (fills?.[s.sku] ? lastPaid(fills[s.sku], me) : undefined)
  const cards = mine.reduce((t, h) => t + (value(h.s) ?? 0) * h.count, 0)
  const cash = totalCash ?? 0
  const known = mine.filter((h) => paid(h.s) !== undefined && value(h.s) !== undefined)
  const gain = known.reduce((n, h) => n + (value(h.s)! - paid(h.s)!) * h.count, 0)
  const pts = fills && mine.length ? series(mine, fills) : []
  const days = PERIODS.find((p) => p[0] === period)![1]
  const since = days ? Date.now() / 1000 - days * 86400 : 0
  const inRange = pts.filter((p) => p.t >= since)
  const start = days ? [...pts].reverse().find((p) => p.t < since) ?? inRange[0] : inRange[0]
  const move = inRange.length && start ? inRange.at(-1)!.price - start.price : undefined
  const cats = [...new Set(mine.map((h) => categoryOf(h.s.name)))]
    .map((c) => [c, mine.filter((h) => categoryOf(h.s.name) === c).reduce((n, h) => n + (value(h.s) ?? 0) * h.count, 0)] as const)
    .sort((a, b) => b[1] - a[1])
  const total = cards + cash
  const best = known.map((h) => ({ h, d: (value(h.s)! - paid(h.s)!) * h.count })).sort((a, b) => b.d - a.d)[0]
  const cols: Col<(typeof mine)[number]>[] = [
    { key: 'card', label: 'Card', cell: (h, tab) => <CardCell s={h.s} tab={tab} note={h.listed ? `${h.listed} listed` : undefined} /> },
    { key: 'held', label: 'Held', right: true, cell: (h) => h.count },
    { key: 'cost', label: 'Cost basis, last price you paid', right: true, cell: (h) => (paid(h.s) !== undefined ? usd(paid(h.s)! * h.count) : <span className="na">Not bought here</span>) },
    { key: 'val', label: `Value at ${basis}, estimated`, right: true, cell: (h) => (value(h.s) !== undefined ? usd(value(h.s)! * h.count) : <span className="na">No price</span>) },
    {
      key: 'gain',
      label: 'Gain or loss, estimated',
      right: true,
      cell: (h) => {
        const p = paid(h.s)
        const v = value(h.s)
        return p !== undefined && v !== undefined ? <span className={v >= p ? 'up' : 'down'}>{delta((v - p) * h.count)}</span> : <span className="muted">—</span>
      },
    },
  ]
  return (
    <>
      <Breadcrumbs items={[['Discover', '#/'], ['Portfolio']]} />
      <h1 className="page-h">Portfolio</h1>
      {error && !data && <ErrorNote what="Couldn’t load your portfolio." why={error} next="Check your connection, then try again." onRetry={refresh} />}
      {!data && !error && (
        <>
          <Skeleton h={56} w={260} r={6} />
          <div style={{ marginTop: 24 }}><Skeleton h={240} r={12} /></div>
        </>
      )}
      {data && (
        <>
          <section className="pf-head">
            <div>
              <span className="cap">Total value, estimated</span>
              <div className="pf-total">{usd(total)}</div>
              <p className="fine pf-parts">
                Cards {usd(cards)} (estimated at {basis}) + cash {usd(cash)} (confirmed balance)
              </p>
              <span className="seg" role="radiogroup" aria-label="Value cards at" style={{ marginTop: 12 }}>
                {([['bid', 'Best offers'], ['ask', 'Asking prices']] as const).map(([k, l]) => (
                  <button key={k} role="radio" aria-checked={at === k} className={at === k ? 'on' : ''} onClick={() => setAt(k)}>
                    {l}
                  </button>
                ))}
              </span>
            </div>
            <div className="pf-stats">
              <StatPill label="Cards owned" value={mine.reduce((n, h) => n + h.count, 0)} note={`${mine.length} different`} />
              <StatPill label="Gain or loss" value={known.length ? delta(gain) : '—'} tone={known.length ? (gain >= 0 ? 'up' : 'down') : undefined} note={known.length ? `Estimated, on ${known.length} of ${mine.length} cards with a known cost` : 'Needs a card bought here'} />
              <StatPill label="Best performer" value={best ? delta(best.d) : '—'} tone={best ? (best.d >= 0 ? 'up' : 'down') : undefined} note={best ? cardTitle(best.h.s.name) : 'Needs a card bought here'} />
            </div>
          </section>

          <section className="section" aria-label="Value over time">
            <div className="hist-head">
              <span className="fine">
                {move !== undefined ? (
                  <>
                    Change over {period === 'All' ? 'all recorded sales' : period}: <b className={move >= 0 ? 'up' : 'down'}>{delta(move)}</b> {start && start.price ? `(${move >= 0 ? '+' : '−'}${pct(Math.abs(move / start.price))})` : ''}, estimated
                  </>
                ) : (
                  'Change over this period needs more recorded sales'
                )}
              </span>
              <span className="seg" role="group" aria-label="Period">
                {PERIODS.map(([k]) => (
                  <button key={k} aria-pressed={period === k} className={period === k ? 'on' : ''} onClick={() => setQuery({ p: k === 'All' ? '' : k })}>
                    {k}
                  </button>
                ))}
              </span>
            </div>
            {!fills ? (
              <Skeleton h={220} r={12} />
            ) : inRange.length > 1 ? (
              <Chart pts={inRange} h={240} tag="Latest estimate" label={`Estimated value of your cards from sale prices, now ${usd(inRange.at(-1)!.price)}`} />
            ) : (
              <Empty title="Not enough sales to draw a chart" detail="The chart needs a sale for every card you hold. It is built from past sale prices at your current holdings, so it never shows guesses." />
            )}
            <p className="source">Estimated from sale prices, using the cards you hold today. It is not your account history.</p>
          </section>

          <section className="section" aria-label="Holdings">
            <h2 className="h2">Holdings</h2>
            {!mine.length ? (
              <Empty title="No cards yet" detail="Buy one from Browse or vault a card you own." action={<a className="ghost line" href="#/browse">Browse cards</a>} />
            ) : (
              <DataTable cols={cols} rows={mine} rowKey={(h) => h.s.sku} label="Holdings" onOpen={(h) => (location.hash = `#/card/${h.s.sku}`)} />
            )}
          </section>

          {mine.length > 0 && (
            <section className="section" aria-label="Allocation">
              <h2 className="h2">Allocation</h2>
              <ul className="alloc">
                {[...cats.map(([c, v]) => [c, v, 'estimated'] as const), ['Cash', cash, 'confirmed'] as const].map(([c, v, how]) => (
                  <li key={c}>
                    <span>{c}</span>
                    <span className="bar" role="img" aria-label={`${c} is ${total ? pct(v / total, 0) : '0%'} of the total`}>
                      <i style={{ width: `${total ? (v / total) * 100 : 0}%` }} />
                    </span>
                    <span className="num">{usd(v)}</span>
                    <span className="num muted">{total ? pct(v / total, 0) : '—'}</span>
                    <small className="muted">{how}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <a className="ghost line" style={{ marginTop: 28 }} href={mine[0] ? `#/redeem/${mine[0].s.sku}` : '#/browse'}>
            Want the physical card? Request it from the vault
          </a>
        </>
      )}
    </>
  )
}

// ===================================================================== activity
type Row = { key: string; s: Sku; side: 'Buy' | 'Sell'; price: number; size: number; status: 'Open' | 'Filled'; t?: number; o?: Order }
type TabId = 'made' | 'watch' | 'orders'

export function Activity({ account }: { account: LocalAccount }) {
  const me = account.address
  const sp = useQuery()
  const tab = (['made', 'watch', 'orders'].includes(sp.get('tab') ?? '') ? sp.get('tab') : 'made') as TabId
  const { data, orders, error, refresh } = usePortfolio(me, true)
  const watch = useWatch()
  const flow = useFlow()
  const skus = (data?.holdings ?? []).map((h) => h.s)
  const open: Row[] = Object.entries(orders ?? {}).flatMap(([id, os]) => {
    const s = skus.find((x) => x.sku === id)
    return s ? os.map((o) => ({ key: `${id}-${o.id}`, s, side: (o.isBuy ? 'Buy' : 'Sell') as Row['side'], price: o.price, size: o.size, status: 'Open' as const, o })) : []
  })
  // Filled orders come from each market's trades, so they need the indexer: reading every market's logs from the RPC is too slow.
  const { data: trades } = usePoll(async () => (indexerUrl && skus.length ? Object.fromEntries(await Promise.all(skus.filter(hasMarket).map(async (s) => [s.sku, (await tradeHistory(s.market)).fills] as const))) as Record<string, Fill[]> : {}), 60000, [skus.map((s) => s.sku).join()])
  const filled: Row[] = skus.flatMap((s) =>
    (trades?.[s.sku] ?? [])
      .filter((f) => f.maker === me.toLowerCase() || f.taker === me.toLowerCase())
      .map((f, i) => ({ key: `${s.sku}-f${i}`, s, side: ((f.taker === me.toLowerCase() ? f.takerBuy : !f.takerBuy) ? 'Buy' : 'Sell') as Row['side'], price: f.price, size: f.size, status: 'Filled' as const, t: f.t })),
  )
  const made = open.filter((r) => r.side === 'Buy')
  const orderRows = [...open.filter((r) => r.side === 'Sell'), ...filled.sort((a, b) => b.t! - a.t!)]
  const watched = skus.filter((s) => watch.list.includes(s.sku))
  const cancel = async (r: Row) => {
    if (await flow.run([[`Cancelled your ${r.o!.isBuy ? 'offer' : 'listing'} at ${usd(r.price)}`, async () => (await send(account, { address: r.s.market, abi: bookAbi, functionName: 'batchCancelOrders', args: [[r.o!.id]] })).transactionHash]])) refresh()
  }
  const act = (r: Row, tabI: 0 | -1): ReactNode =>
    r.o ? (
      <button className="mini" tabIndex={tabI} disabled={flow.busy} onClick={() => cancel(r)}>
        Cancel
      </button>
    ) : null
  const card = (r: Row, tabI: 0 | -1) => <CardCell s={r.s} tab={tabI} />
  const madeCols: Col<Row>[] = [
    { key: 'card', label: 'Card', cell: card },
    { key: 'offer', label: 'Your offer', right: true, cell: (r) => usd(r.price) },
    { key: 'n', label: 'Copies', right: true, cell: (r) => r.size },
    { key: 'top', label: 'Best offer now', right: true, cell: (r) => (r.s.bid ? usd(r.s.bid) : '—') },
    { key: 'st', label: 'Status', cell: (r) => (r.s.bid !== undefined && r.price >= r.s.bid ? 'Open, best offer' : 'Open, below the best offer') },
    { key: 'act', label: 'Actions', right: true, cell: (r, t) => <span className="row-actions">{act(r, t)}</span> },
  ]
  const orderCols: Col<Row>[] = [
    { key: 'card', label: 'Card', cell: card },
    { key: 'side', label: 'Side', cell: (r) => (r.side === 'Buy' ? 'Buy' : 'Sell') },
    { key: 'price', label: 'Price', right: true, cell: (r) => usd(r.price) },
    { key: 'n', label: 'Copies', right: true, cell: (r) => r.size },
    { key: 'st', label: 'Status', cell: (r) => r.status },
    { key: 'when', label: 'When', cell: (r) => (r.t ? `${stamp(r.t)} · ${ago(r.t)}` : 'Waiting to fill') },
    { key: 'act', label: 'Actions', right: true, cell: (r, t) => <span className="row-actions">{act(r, t)}</span> },
  ]
  const watchCols: Col<Sku>[] = [
    { key: 'card', label: 'Card', cell: (s, t) => <CardCell s={s} tab={t} /> },
    { key: 'ask', label: 'Ask', right: true, cell: (s) => askText(s, hasMarket(s)) },
    { key: 'bid', label: 'Best offer', right: true, cell: (s) => offerText(s, hasMarket(s)) },
    { key: 'last', label: 'Last sale', right: true, cell: (s) => lastText(s) },
    { key: 'act', label: 'Actions', right: true, cell: (s, t) => <span className="row-actions"><button className="mini" tabIndex={t} onClick={() => watch.toggle(s.sku)}>Stop watching</button></span> },
  ]
  const body = !data ? (
    error ? <ErrorNote what="Couldn’t load your activity." why={error} next="Check your connection, then try again." onRetry={refresh} /> : <TableSkeleton cols={tab === 'watch' ? watchCols : tab === 'made' ? madeCols : orderCols} rows={4} />
  ) : tab === 'made' ? (
    made.length ? <DataTable cols={madeCols} rows={made} rowKey={(r) => r.key} label="Offers made" /> : <Empty title="No open offers" detail="Offers you make wait here until a seller accepts or you cancel." action={<a className="ghost line" href="#/browse">Browse cards</a>} />
  ) : tab === 'watch' ? (
    watched.length ? <DataTable cols={watchCols} rows={watched} rowKey={(s) => s.sku} label="Watchlist" onOpen={(s) => (location.hash = `#/card/${s.sku}`)} /> : <Empty title="Nothing on your watchlist" detail="Use Watch on a card page or in a Browse table and it appears here." action={<a className="ghost line" href="#/browse">Browse cards</a>} />
  ) : orderRows.length ? (
    <DataTable cols={orderCols} rows={orderRows} rowKey={(r) => r.key} label="Orders" />
  ) : (
    <Empty title="No orders yet" detail={indexerUrl ? 'Listings you post and trades you make appear here.' : 'Open listings appear here. Filled orders need the price indexer, which is not set up.'} />
  )
  return (
    <>
      <Breadcrumbs items={[['Discover', '#/'], ['Activity']]} />
      <h1 className="page-h">Activity</h1>
      <Tabs<TabId> label="Activity" value={tab} onChange={(t) => setQuery({ tab: t === 'made' ? '' : t })} tabs={[['made', 'Offers made', data ? made.length : undefined], ['watch', 'Watchlist', data ? watched.length : undefined], ['orders', 'Orders', data ? orderRows.length : undefined]]} />
      <div className="tabpanel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {body}
        <Steps steps={flow.steps} error={flow.error} />
        <p className="source">Offers received are not shown: the order book is anonymous, so an offer cannot be addressed to you.</p>
      </div>
    </>
  )
}
