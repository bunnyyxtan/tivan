import { useMemo } from 'react'
import { PageHead, Stat } from './kit'
import { openCash } from './Cash'
import type { LocalAccount } from 'viem'
import { cents } from './cardParts'
import { Checklist } from './Checklist'
import { reservedUnits } from './Cash'
import { tradeHistory, type Fill } from './chain'
import { Seg } from './controls'
import { Chart, DataTable, type Col } from './desk'
import { categoryOf } from './config'
import { centsToUnits, formatBps, formatQty, formatUsd } from './logic/money.ts'
import { averageBuyUnits, unrealisedPnl } from './logic/orders.ts'
import { change, valueSeries, type MarketFills } from './logic/portfolioMath.ts'
import { usePortfolio } from './portfolio'
import { setQuery, useQuery } from './route'
import { Empty, ErrorNote, Skeleton } from './States'
import { Slab, cardSub, cardTitle, usePoll } from './ui'

const PERIODS = [['1M', 30], ['3M', 90], ['1Y', 365], ['All', 0]] as const
type Period = (typeof PERIODS)[number][0]
const usd = (u: bigint, d: 'auto' | 2 = 'auto', sign = false) => formatUsd(u, { digits: d, sign: sign ? 'always' : 'auto' })

/** The account's side of each fill on a market. */
const mineOf = (f: Fill, me: string): 'buy' | 'sell' | undefined => {
  const a = me.toLowerCase()
  return f.taker === a ? (f.takerBuy ? 'buy' : 'sell') : f.maker === a ? (f.takerBuy ? 'sell' : 'buy') : undefined
}

export function Portfolio({ account }: { account: LocalAccount }) {
  const me = account.address
  const sp = useQuery()
  const period = (PERIODS.find((p) => p[0] === sp.get('p'))?.[0] ?? 'All') as Period
  const { data, orders, error, refresh } = usePortfolio(me, true)
  const held = (data?.holdings ?? []).filter((h) => h.count > 0)
  const key = held.map((h) => h.s.sku).join()
  const hist = usePoll(async () => Object.fromEntries(await Promise.all(held.map(async (h) => [h.s.sku, (await tradeHistory(h.s.market)).fills] as const))) as Record<string, Fill[]>, 30000, [key])
  const fills = hist.data

  const rows = held.map((h) => {
    const f = fills?.[h.s.sku]
    const avg = f ? averageBuyUnits(f.map((x) => ({ price: cents(x.price), size: BigInt(x.size), mine: mineOf(x, me) }))) : undefined
    const bid = h.s.bid ? cents(h.s.bid) : undefined
    const qty = BigInt(h.count)
    const value = bid !== undefined ? centsToUnits(bid) * qty : undefined
    const pnl = avg && bid !== undefined ? unrealisedPnl(qty, avg.avgUnits, centsToUnits(bid)) : undefined
    return { h, qty, avg, bid, value, pnl }
  })
  type Row = (typeof rows)[number]
  const cards = rows.reduce((n, r) => n + (r.value ?? 0n), 0n)
  const unmarked = rows.filter((r) => r.value === undefined).length
  const available = data ? data.cashRaw + data.exCashRaw : 0n
  const reserved = orders ? reservedUnits(orders) : 0n
  const total = cards + available + reserved
  const known = rows.filter((r) => r.pnl !== undefined)
  const pnlSum = known.reduce((n, r) => n + r.pnl!, 0n)

  const series = useMemo(() => {
    if (!fills) return []
    const mk: MarketFills[] = held.map((h) => ({ qtyNow: BigInt(h.count), fills: (fills[h.s.sku] ?? []).map((x) => ({ t: x.t, priceCents: cents(x.price), size: BigInt(x.size), mine: mineOf(x, me) })) }))
    return valueSeries(mk)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fills, key])
  const days = PERIODS.find((p) => p[0] === period)![1]
  const since = days ? Math.floor(Date.now() / 1000) - days * 86400 : 0
  const ch = change(series, since)
  const inRange = series.filter((p) => p.t >= since)

  const cats = [...new Set(rows.map((r) => categoryOf(r.h.s.name)))]
    .map((c) => [c, rows.filter((r) => categoryOf(r.h.s.name) === c).reduce((n, r) => n + (r.value ?? 0n), 0n)] as const)
    .sort((a, b) => (b[1] > a[1] ? 1 : -1))
  const alloc = [...cats.map(([c, v]) => ({ name: c, v, how: 'valued at best offer' })), { name: 'Cash', v: available + reserved, how: 'confirmed balance' }]
  const share = (v: bigint) => (total > 0n ? Number((v * 10_000n) / total) / 100 : 0)

  const cols: Col<Row>[] = [
    { key: 'card', label: 'Card', cell: (r, t) => <a className="tcard" href={`#/card/${r.h.s.sku}`} tabIndex={t}><Slab name={r.h.s.name} size="xs" /><span><b>{cardTitle(r.h.s.name)}</b><small>{cardSub(r.h.s.name).split(' · ')[0]}{r.h.listed ? ` · ${r.h.listed} listed` : ''}</small></span></a> },
    { key: 'qty', label: 'Held', right: true, cell: (r) => formatQty(r.qty) },
    { key: 'cost', label: 'Average cost', right: true, cell: (r) => (r.avg ? usd(r.avg.avgUnits, 2) : <span className="na">Not bought here</span>) },
    { key: 'val', label: 'Value', right: true, cell: (r) => (r.value !== undefined ? usd(r.value, 2) : <span className="na">No offers</span>) },
    { key: 'pnl', label: 'Unrealised P&L', right: true, cell: (r) => (r.pnl !== undefined ? <span className={r.pnl >= 0n ? 'up' : 'down'}>{usd(r.pnl, 2, true)}</span> : <span className="muted">—</span>) },
  ]
  return (
    <>
      <PageHead title="Portfolio" sub={data ? <>Total value, estimated · <b className="fig">{usd(total, 2)}</b></> : 'Reading your account'}>
        <button className="ghost line md" onClick={openCash}>Add cash</button>
        <a className="btn md" href="#/browse">Find a card</a>
      </PageHead>
      {error && !data && <ErrorNote what="Couldn’t load your portfolio." why={error} next="Check your connection, then try again." onRetry={refresh} />}
      {!data && !error && <Skeleton h={240} r={12} />}
      {data && (
        <>
          <section className="stats4" aria-label="Value">
            <Stat label="Total value" value={usd(total, 2)} note="Cards, cash and reserved offers" />
            <Stat label="Cash available" value={usd(available, 2)} note={`${usd(reserved, 2)} reserved in open offers`} />
            <Stat label="Cards held" value={formatQty(rows.reduce((n, r) => n + r.qty, 0n))} note={`${usd(cards, 2)} at best offers · ${rows.length} market${rows.length === 1 ? '' : 's'}`} />
            <Stat label="Unrealised P&L" value={known.length ? usd(pnlSum, 2, true) : '—'} tone={known.length ? (pnlSum >= 0n ? 'up' : 'down') : undefined} note={known.length ? `On ${known.length} of ${rows.length} markets, at best offer` : 'Needs a card bought here'} />
          </section>
          <p className="fine pf-parts">
                Cards {usd(cards, 2)} (valued at best offer) + available cash {usd(available, 2)} (confirmed) + {usd(reserved, 2)} reserved in open offers (confirmed).
                {unmarked ? ` ${unmarked} card${unmarked === 1 ? ' has' : 's have'} no offer, so ${unmarked === 1 ? 'it is' : 'they are'} left out of the cards figure.` : ''}
          </p>
          <Checklist account={account} />

          <section className="section" aria-label="Value over time">
            <div className="hist-head">
              <span className="fine">
                {ch ? <>Change over {period === 'All' ? 'all recorded trades' : period}: <b>{usd(ch.units, 2, true)}</b>{ch.bps !== undefined ? ` (${formatBps(ch.bps, { sign: 'always' })})` : ''}</> : 'Change over this period needs more recorded trades'}
              </span>
              <Seg label="Period" value={period} onChange={(k) => setQuery({ p: k === 'All' ? '' : k })} options={PERIODS.map(([k]) => ({ value: k, label: k }))} />
            </div>
            {!fills ? <Skeleton h={220} r={12} /> : inRange.length > 1 ? (
              <Chart pts={inRange.map((p) => ({ t: p.t, price: Number(p.units) / 1e6 }))} h={240} tag="Latest" label={`Value of your cards over time, now ${usd(inRange.at(-1)!.units, 2)}`} />
            ) : (
              <Empty title="Not enough trades to draw a chart" detail="It is built from your trades and each market’s last sale price at the time, and it needs a sale on every market you hold. We do not draw lines from guesses." />
            )}
            <p className="source">Cards only, valued at each market’s last sale price at the time. Your holdings are worked back from today using your own trades.</p>
          </section>

          <section className="section" aria-label="Holdings">
            <h2 className="h2">Holdings</h2>
            {!rows.length ? (
              <Empty title="No cards yet" detail="Buy one from Browse, or sell a card you own and add it to the vault." action={<span className="actions-row"><a className="btn md" href="#/browse">Browse cards</a><a className="ghost line s40" href="#/sell">Sell your card</a></span>} />
            ) : (
              <>
                <DataTable cols={cols} rows={rows} rowKey={(r) => r.h.s.sku} label="Holdings" onOpen={(r) => (location.hash = `#/card/${r.h.s.sku}`)} />
                <p className="source">Average cost is the average price of your purchases on that market. Value is quantity times the best offer. Unrealised P&amp;L is value less cost. Nothing here is a sale.</p>
              </>
            )}
          </section>

          {rows.length > 0 && (
            <section className="section" aria-label="Allocation">
              <h2 className="h2">Allocation</h2>
              <ul className="alloc">
                {alloc.map((a) => (
                  <li key={a.name}>
                    <span>{a.name}</span>
                    <span className="bar" role="img" aria-label={`${a.name} is ${Math.round(share(a.v))}% of the total`}><i style={{ width: `${share(a.v)}%` }} /></span>
                    <span className="num">{usd(a.v, 2)}</span>
                    <span className="num muted">{total ? formatBps((a.v * 10_000n) / total, { digits: 0 }) : '—'}</span>
                    <small className="muted">{a.how}</small>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="acc-links"><a className="ghost line s40" href="#/activity?tab=open">Open orders</a> <a className="ghost line s40" href="#/sell">Sell your card</a></p>
        </>
      )}
    </>
  )
}
