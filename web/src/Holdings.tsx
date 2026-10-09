import { useMemo } from 'react'
import { PageHead } from './kit'
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
import { ErrorNote, Skeleton } from './States'
import { IconActivity } from './icons'
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
    { key: 'val', label: 'Value', right: true, cell: (r) => (r.value !== undefined ? <b className="fig">{usd(r.value, 2)}</b> : <span className="na">No offers</span>) },
    { key: 'pnl', label: 'Unrealised P&L', right: true, cell: (r) => (r.pnl !== undefined ? <span className={r.pnl >= 0n ? 'up' : 'down'}>{usd(r.pnl, 2, true)}</span> : <span className="muted">—</span>) },
  ]
  const pct = (v: bigint) => `${share(v)}%`
  const sample = (data?.holdings ?? []).slice(0, 3).map((h) => h.s.name)
  const cardCount = rows.reduce((n, r) => n + r.qty, 0n)
  return (
    <>
      <PageHead title="Portfolio" sub="Your cards, cash and open offers, valued from the live order books">
        <button className="ghost line md" onClick={openCash}>Add cash</button>
        <a className="btn md" href="#/browse">Find a card</a>
      </PageHead>
      {error && !data && <ErrorNote what="Couldn’t load your portfolio." why={error} next="Check your connection, then try again." onRetry={refresh} />}
      {!data && !error && <Skeleton h={260} r={16} />}
      {data && (
        <>
          <section className="pf-hero" aria-label="Value">
            <div className="pf-hero-main">
              <span className="lbl-caps">Total value, estimated</span>
              <b className="pf-big">{usd(total, 2)}</b>
              <span className="pf-change">
                {ch ? <><span className={ch.units >= 0n ? 'delta up' : 'delta down'}>{usd(ch.units, 2, true)}{ch.bps !== undefined ? ` · ${formatBps(ch.bps, { sign: 'always' })}` : ''}</span> over {period === 'All' ? 'all recorded trades' : period}</> : 'Change shows once the markets you hold have traded'}
              </span>
              <div className="pf-split" role="img" aria-label={`Cards ${pct(cards)}, reserved ${pct(reserved)}, cash ${pct(available)} of the total`}>
                {total > 0n ? <><i className="c" style={{ width: pct(cards) }} /><i className="r" style={{ width: pct(reserved) }} /><i className="k" style={{ width: pct(available) }} /></> : <i className="none" />}
              </div>
              <ul className="pf-legend">
                <li><i className="c" />Cards <b>{usd(cards, 2)}</b></li>
                <li><i className="r" />Reserved in offers <b>{usd(reserved, 2)}</b></li>
                <li><i className="k" />Cash <b>{usd(available, 2)}</b></li>
              </ul>
            </div>
            <dl className="pf-hero-figs">
              <div><dt>Cards held</dt><dd>{formatQty(cardCount)}</dd><small>{rows.length} market{rows.length === 1 ? '' : 's'}</small></div>
              <div><dt>Unrealised P&amp;L</dt><dd className={known.length ? (pnlSum >= 0n ? 'up' : 'down') : ''}>{known.length ? usd(pnlSum, 2, true) : '—'}</dd><small>{known.length ? 'At best offer, against your cost' : 'Needs a card bought here'}</small></div>
              <div><dt>Cash available</dt><dd>{usd(available, 2)}</dd><small><button className="linkbtn" onClick={openCash}>Add cash</button></small></div>
              <div><dt>Open orders</dt><dd>{orders ? Object.values(orders).flat().length : '—'}</dd><small><a className="linkbtn" href="#/activity?tab=open">Manage</a></small></div>
            </dl>
          </section>
          {unmarked > 0 && <p className="fine pf-parts">{unmarked} card{unmarked === 1 ? ' has' : 's have'} no offer, so {unmarked === 1 ? 'it is' : 'they are'} left out of the cards figure.</p>}

          <div className="pf-grid">
            <div className="pf-main">
              <section className="pnl" aria-labelledby="pf-hold">
                <header className="pnl-h"><h2 id="pf-hold">Holdings</h2><span className="pnl-meta">{rows.length ? `${formatQty(cardCount)} card${cardCount === 1n ? '' : 's'} in ${rows.length} market${rows.length === 1 ? '' : 's'}` : 'Empty'}</span></header>
                {!rows.length ? (
                  <div className="pnl-empty pf-empty">
                    {sample.length > 0 && <span className="catcard-fan pf-fan" aria-hidden>{sample.map((n) => <Slab key={n} name={n} size="sm" />)}</span>}
                    <b>No cards in your portfolio yet</b>
                    <p className="fine">Buy one at the ask, make an offer below it, or check in a slab you own.</p>
                    <span className="pf-empty-act"><a className="btn md" href="#/browse">Browse markets</a><a className="ghost line md" href="#/sell">Sell a card</a></span>
                  </div>
                ) : (
                  <>
                    <div className="pnl-table"><DataTable cols={cols} rows={rows} rowKey={(r) => r.h.s.sku} label="Holdings" onOpen={(r) => (location.hash = `#/card/${r.h.s.sku}`)} /></div>
                    <p className="source">Average cost is the average price of your purchases on that market. Value is quantity times the best offer. Nothing here is a sale.</p>
                  </>
                )}
              </section>

              <section className="pnl" aria-labelledby="pf-chart">
                <header className="pnl-h">
                  <h2 id="pf-chart">Value of your cards</h2>
                  <Seg label="Period" value={period} onChange={(k) => setQuery({ p: k === 'All' ? '' : k })} options={PERIODS.map(([k]) => ({ value: k, label: k }))} />
                </header>
                {!fills ? <Skeleton h={220} r={12} /> : inRange.length > 1 ? (
                  <Chart pts={inRange.map((p) => ({ t: p.t, price: Number(p.units) / 1e6 }))} h={240} tag="Latest" label={`Value of your cards over time, now ${usd(inRange.at(-1)!.units, 2)}`} />
                ) : (
                  <div className="pnl-empty pf-chart-empty">
                    <IconActivity />
                    <b>{rows.length ? 'Not enough trades to draw a line' : 'Your chart starts with your first card'}</b>
                    <p className="fine">It is built from your own trades and each market’s last sale at the time. We do not draw lines from guesses.</p>
                  </div>
                )}
              </section>
            </div>

            <aside className="pf-side">
              <Checklist account={account} />
              <section className="pnl" aria-labelledby="pf-alloc">
                <header className="pnl-h"><h2 id="pf-alloc">Allocation</h2><span className="pnl-meta">Share of total</span></header>
                {total === 0n ? <p className="fine">Allocation appears once you hold cash or cards.</p> : (
                  <ul className="alloc2">
                    {alloc.filter((x) => x.v > 0n).map((x) => (
                      <li key={x.name}>
                        <span className="alloc2-top"><b>{x.name}</b><span className="fig">{usd(x.v, 2)}</span></span>
                        <span className="bar" role="img" aria-label={`${x.name} is ${Math.round(share(x.v))}% of the total`}><i style={{ width: `${share(x.v)}%` }} /></span>
                        <small>{formatBps((x.v * 10_000n) / total, { digits: 0 })} · {x.how}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </>
  )
}
