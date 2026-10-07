import { useState } from 'react'
import type { LocalAccount } from 'viem'
import { bookAbi, lastPaid, send, tradeHistory, type Order } from './chain'
import { usePortfolio } from './portfolio'
import { Empty, RowSkeleton, Skeleton } from './States'
import { pct } from './format'
import { Header, Slab, Steps, cardSub, cardTitle, delta, useFlow, usePoll, usd } from './ui'

export function Collection({ account }: { account: LocalAccount }) {
  const me = account.address
  const { data, orders, totalCash, refresh } = usePortfolio(me, true)
  const mine = (data?.holdings ?? []).filter((h) => h.count > 0)
  // What you paid comes from your own fills, so it is only known for cards bought on the exchange.
  const { data: paid } = usePoll(async () => Object.fromEntries(await Promise.all(mine.map(async (h) => [h.s.sku, lastPaid((await tradeHistory(h.s.market)).fills, me)] as const))), 30000, [mine.map((h) => h.s.sku).join()])
  const [at, setAt] = useState<'now' | 'ask'>('now')
  const value = (h: (typeof mine)[number]) => (at === 'now' ? h.s.bid : (h.s.ask ?? h.s.bid))
  const cards = mine.reduce((t, h) => t + (value(h) ?? 0) * h.count, 0)
  const cost = mine.reduce((t, h) => (paid?.[h.s.sku] !== undefined ? t + paid[h.s.sku]! * h.count : t), 0)
  const costKnown = mine.length > 0 && mine.every((h) => paid?.[h.s.sku] !== undefined)
  const best = mine
    .map((h) => ({ h, d: paid?.[h.s.sku] !== undefined && value(h) ? (value(h)! - paid[h.s.sku]!) * h.count : undefined }))
    .filter((x): x is { h: (typeof mine)[number]; d: number } => x.d !== undefined)
    .sort((a, b) => b.d - a.d)[0]
  const alloc = cards + (totalCash ?? 0) > 0 ? cards / (cards + (totalCash ?? 0)) : 0
  const open = Object.entries(orders ?? {}).flatMap(([sku, os]) => os.map((o) => ({ o, h: data?.holdings.find((x) => x.s.sku === sku) })))
  return (
    <>
      <Header title="Collection" />
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span className="cap">{at === 'now' ? 'Value if sold at the top offers' : 'Value at today’s asking prices'}</span>
          <span className="seg" role="radiogroup" aria-label="Value cards at">
            <button role="radio" aria-checked={at === 'now'} className={at === 'now' ? 'on' : ''} onClick={() => setAt('now')}>
              Offers
            </button>
            <button role="radio" aria-checked={at === 'ask'} className={at === 'ask' ? 'on' : ''} onClick={() => setAt('ask')}>
              Asking
            </button>
          </span>
        </div>
        <div className="pf-total">{data ? usd(cards + (totalCash ?? 0)) : <Skeleton h={46} w={200} r={8} />}</div>
        <p className="fine pf-parts" style={{ fontSize: 14 }}>
          Cards {usd(cards)} + cash {usd(totalCash)}
          {costKnown && <span className={`gain ${cards - cost >= 0 ? 'up' : 'down'}`}>{delta(cards - cost)} against your last purchase prices</span>}
        </p>
      </section>

      {data && (
        <div className="stats">
          <div className="stat">
            <span className="lbl">Cards owned</span>
            <b>{mine.reduce((n, h) => n + h.count, 0)}</b>
            <small>{mine.length} different</small>
          </div>
          <div className="stat">
            <span className="lbl">In cards</span>
            <b>{pct(alloc, 0)}</b>
            <small>{pct(1 - alloc, 0)} is cash</small>
          </div>
          <a className="stat" href={best ? `#/card/${best.h.s.sku}` : '#/'}>
            <span className="lbl">Best performer</span>
            <b className={best ? (best.d >= 0 ? 'up' : 'down') : undefined}>{best ? delta(best.d) : '—'}</b>
            <small>{best ? cardTitle(best.h.s.name) : 'Needs a card bought here'}</small>
          </a>
        </div>
      )}

      <section className="section">
        {data && orders && !mine.length && <Empty title="No cards yet" detail="Buy one from Markets or vault a card you own." action={<a className="ghost line" href="#/">Browse markets</a>} />}
        {(!data || (!orders && !mine.length)) && [0, 1].map((i) => <RowSkeleton key={i} />)}
        <div className="rows">
          {mine.map((h) => {
            const v = value(h)
            const p = paid?.[h.s.sku]
            return (
              <a key={h.s.sku} className="mrow" href={`#/card/${h.s.sku}`}>
                <span className="mrow-name">
                  <Slab name={h.s.name} size="xs" vt={`card-${h.s.sku}`} />
                  <span className="mrow-info">
                    <span className="mrow-title">{cardTitle(h.s.name)}</span>
                    <span className="mrow-sub">
                      {cardSub(h.s.name)} · {h.count} owned{h.listed ? `, ${h.listed} listed` : ''}
                      {p !== undefined ? ` · paid ${usd(p)}` : ''}
                    </span>
                  </span>
                </span>
                <span className="mrow-val">
                  <span>{v ? usd(v * h.count) : '—'}</span>
                  <small className={p !== undefined && v ? (v - p >= 0 ? 'up' : 'down') : undefined}>{p !== undefined && v ? delta((v - p) * h.count) : v ? (at === 'now' ? 'at top offer' : 'at asking') : 'no price yet'}</small>
                </span>
              </a>
            )
          })}
        </div>
      </section>

      {open.length > 0 && <OpenList open={open} account={account} done={refresh} />}

      <a className="mrow panel" href={mine[0] ? `#/redeem/${mine[0].s.sku}` : '#/'} style={{ marginTop: 26, marginLeft: 0, marginRight: 0 }}>
        <span className="mrow-info">
          <span className="mrow-title">Want the physical card?</span>
          <span className="mrow-sub">Request it from the vault custodian</span>
        </span>
        <span className="muted">›</span>
      </a>
    </>
  )
}

function OpenList({ open, account, done }: { open: { o: Order; h?: { s: { sku: string; name: string; market: `0x${string}` } } }[]; account: LocalAccount; done: () => void }) {
  const flow = useFlow()
  const cancel = async (o: Order, market: `0x${string}`) => {
    if (await flow.run([[`Cancelled your ${o.isBuy ? 'offer' : 'listing'} at ${usd(o.price)}`, async () => (await send(account, { address: market, abi: bookAbi, functionName: 'batchCancelOrders', args: [[o.id]] })).transactionHash]])) done()
  }
  return (
    <section className="section">
      <span className="cap">Waiting to fill</span>
      <div className="rows">
        {open.map(({ o, h }) =>
          h ? (
            <div key={`${h.s.sku}-${o.id}`} className="kv" style={{ alignItems: 'center' }}>
              <span style={{ color: 'var(--tx)' }}>
                {o.isBuy ? 'Offer on' : 'Selling'} {cardTitle(h.s.name)} at {usd(o.price)}
              </span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="ghost pill" disabled={flow.busy} onClick={() => cancel(o, h.s.market)}>
                  Cancel
                </button>
              </span>
            </div>
          ) : null,
        )}
      </div>
      <Steps steps={flow.steps} error={flow.error} />
    </section>
  )
}
