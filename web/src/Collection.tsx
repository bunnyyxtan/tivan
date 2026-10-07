import { useState } from 'react'
import type { LocalAccount } from 'viem'
import { bookAbi, lastPaid, send, tradeHistory, type Order } from './chain'
import { usePortfolio } from './portfolio'
import { Card, CountUp, Ring } from './fx'
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
      <section className="rise">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="cap">{at === 'now' ? 'If you sold everything now' : 'At today’s asking prices'}</span>
          <span className="seg" role="radiogroup" aria-label="Value cards at">
            <button role="radio" aria-checked={at === 'now'} className={at === 'now' ? 'on' : ''} onClick={() => setAt('now')}>
              Sell now
            </button>
            <button role="radio" aria-checked={at === 'ask'} className={at === 'ask' ? 'on' : ''} onClick={() => setAt('ask')}>
              Asking
            </button>
          </span>
        </div>
        <div className="big" style={{ fontSize: 48, marginTop: 6 }}>
          {data ? usd(cards + (totalCash ?? 0)) : '—'}
        </div>
        <p className="fine" style={{ fontSize: 14 }}>
          Cards {usd(cards)} + cash {usd(totalCash)}
          {costKnown && <span className={cards - cost >= 0 ? 'up' : 'down'}> · {delta(cards - cost)} vs. what you paid</span>}
        </p>
      </section>

      {data && (
        <div className="cards-grid" style={{ marginTop: 14 }}>
          <Card variant="stat" i={0}>
            <div className="k">Cards owned</div>
            <div className="n"><CountUp value={mine.reduce((n, h) => n + h.count, 0)} /></div>
            <div className="s">{mine.length} different {mine.length === 1 ? 'card' : 'cards'}</div>
          </Card>
          <Card variant="stat" i={1}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <Ring value={alloc}><span>{Math.round(alloc * 100)}%</span></Ring>
              <div>
                <div className="k">In cards</div>
                <div className="s">{Math.round((1 - alloc) * 100)}% is cash</div>
              </div>
            </div>
          </Card>
          <Card variant="feature" i={2} href={best ? `#/card/${best.h.s.sku}` : '#/'}>
            <div className="k">Best performer</div>
            <div className="n" style={{ fontSize: 24 }}>{best ? cardTitle(best.h.s.name) : '—'}</div>
            <div className="s">{best ? <span className={best.d >= 0 ? 'up' : 'down'}>{delta(best.d)} vs. what you paid</span> : 'Shows once you have bought a card here'}</div>
          </Card>
          <Card variant="action" i={3} href="#/vault">
            <span className="t">Vault a card</span>
            <span className="s">Check a cert and list it</span>
            <i className="go">→</i>
          </Card>
        </div>
      )}

      <section className="section">
        {data && orders && !mine.length && (
          <div className="empty">
            No cards yet. <a className="u" href="#/">Buy one</a> or <a className="u" href="#/vault">vault your own</a>.
          </div>
        )}
        {(!data || (!orders && !mine.length)) && [0, 1].map((i) => <div key={i} className="skeleton" />)}
        <div className="rows">
          {mine.map((h) => {
            const v = value(h)
            const p = paid?.[h.s.sku]
            return (
              <a key={h.s.sku} className="mrow" href={`#/card/${h.s.sku}`}>
                <Slab name={h.s.name} size="xs" vt={`card-${h.s.sku}`} />
                <span className="mrow-info">
                  <span className="mrow-title">{cardTitle(h.s.name)}</span>
                  <span className="mrow-sub">
                    {cardSub(h.s.name)} · {h.count} owned{h.listed ? `, ${h.listed} listed` : ''}
                    {p !== undefined ? ` · paid ${usd(p)}` : ''}
                  </span>
                </span>
                <span className="mrow-px">
                  <span>{v ? usd(v * h.count) : '—'}</span>
                  <span className={p !== undefined && v ? (v - p >= 0 ? 'up' : 'down') : undefined}>{p !== undefined && v ? delta((v - p) * h.count) : v ? (at === 'now' ? 'top offer' : 'asking') : 'no price yet'}</span>
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
