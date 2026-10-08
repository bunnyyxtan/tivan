import type { ReactNode } from 'react'
import type { Sku } from './chain'
import { cents, usdC } from './cardParts'
import { ago, type Change } from './desk'
import { pct } from './format'
import { Slab, cardSub, cardTitle } from './ui'

// The small shared pieces every page is built from: page head, figures, change, sparkline, market tile.

/** Sale prices for one market, oldest first, from the shared recent-sales feed. */
export const pointsFor = (fills: { sku: string; price: number; t: number }[] | undefined, sku: string) =>
  (fills ?? []).filter((f) => f.sku.toLowerCase() === sku.toLowerCase()).map((f) => f.price).reverse()

/** Time of the newest sale in one market, in seconds, if the feed has one. */
export const lastSaleAt = (fills: { sku: string; t: number }[] | undefined, sku: string) => (fills ?? []).find((f) => f.sku.toLowerCase() === sku.toLowerCase())?.t

/** A line of the last sales. Decorative: the figures beside it carry the meaning. */
export function Spark({ pts, tone, w = 96, h = 28 }: { pts: number[]; tone?: 'up' | 'down'; w?: number; h?: number }) {
  if (pts.length < 2) return <span className="spark spark-none" style={{ width: w, height: h }} aria-hidden />
  const lo = Math.min(...pts)
  const hi = Math.max(...pts)
  const y = (p: number) => (hi === lo ? h / 2 : h - 2 - ((p - lo) / (hi - lo)) * (h - 4))
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * w).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  return (
    <svg className={`spark ${tone ?? ''}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} />
      <circle cx={w} cy={y(pts.at(-1)!)} r="2" />
    </svg>
  )
}

/** Last sale against the one before it, as a signed figure on a faint tint. Nothing when there is no earlier sale. */
export function Delta({ c, empty = '—' }: { c?: Change; empty?: ReactNode }) {
  if (!c) return <span className="delta flat">{empty}</span>
  const up = c.pct >= 0
  return (
    <span className={`delta ${up ? 'up' : 'down'}`}>
      <span aria-hidden>{up ? '▲' : '▼'}</span>
      <span className="sr">{up ? 'Up' : 'Down'}</span> {pct(Math.abs(c.pct))}
    </span>
  )
}

/** The head of every page: title, one line of context, and the page's own actions on the right. */
export function PageHead({ title, sub, children, crumbs }: { title: ReactNode; sub?: ReactNode; children?: ReactNode; crumbs?: ReactNode }) {
  return (
    <header className="phead">
      {crumbs}
      <div className="phead-row">
        <div className="phead-text">
          <h1>{title}</h1>
          {sub && <p className="phead-sub">{sub}</p>}
        </div>
        {children && <div className="phead-act">{children}</div>}
      </div>
    </header>
  )
}

/** A labelled figure: small capital label, the number, one line of what it means. */
export function Stat({ label, value, note, tone }: { label: string; value: ReactNode; note?: ReactNode; tone?: 'up' | 'down' }) {
  return (
    <div className="stat2">
      <span className="stat2-l">{label}</span>
      <span className={`stat2-v ${tone ?? ''}`}>{value}</span>
      {note !== undefined && <span className="stat2-n">{note}</span>}
    </div>
  )
}

/** A live dot and the time the data was read. */
export const Live = ({ at, label = 'Live' }: { at?: number; label?: string }) => (
  <span className="live">
    <i aria-hidden />
    {label}
    {at ? ` · ${new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
  </span>
)

/** The market tile used in every grid: the slab on its stage, then price, change, the recent sales and the depth. */
export function MarketTile({ s, c, pts, tag, at }: { s: Sku; c?: Change; pts: number[]; tag?: string; at?: number }) {
  const price = s.ask ?? s.last
  return (
    <a className="mtile" href={`#/card/${s.sku}`}>
      <span className="mtile-art">
        {tag && <span className="badge">{tag}</span>}
        {at && <span className="fresh">{ago(at)}</span>}
        <Slab name={s.name} size="md" />
      </span>
      <span className="mtile-body">
        <span className="mtile-title">{cardTitle(s.name)}</span>
        <span className="mtile-sub">{cardSub(s.name)}</span>
        <span className="mtile-price">
          <span>
            <small>{s.ask ? 'Lowest ask' : s.last ? 'Last sale' : 'No sellers'}</small>
            <b>{price ? usdC(cents(price)) : '—'}</b>
          </span>
          <Spark pts={pts} tone={c ? (c.pct >= 0 ? 'up' : 'down') : undefined} w={72} h={24} />
        </span>
        <span className="mtile-foot">
          <span>Offer <b>{s.bid ? usdC(cents(s.bid)) : '—'}</b></span>
          <Delta c={c} empty="" />
        </span>
      </span>
    </a>
  )
}
