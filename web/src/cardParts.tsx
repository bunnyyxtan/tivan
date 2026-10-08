import { useEffect, useId, useState, type ReactNode } from 'react'
import { centsToUnits, formatBps, formatUsd } from './logic/money.ts'
import { spread } from './logic/orders.ts'

/** Cents as dollars for display: whole dollars when there are no cents. */
export const usdC = (cents: bigint, digits: 'auto' | 2 = 'auto') => formatUsd(centsToUnits(cents), { digits })
export const cents = (dollars: number) => BigInt(Math.round(dollars * 100))

/** The markets this person opened lately, newest first, kept in this browser. */
const VIEWED = 'tivan.viewed'
export const readViewed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(VIEWED) ?? '[]')
  } catch {
    return []
  }
}
export const recordViewed = (sku: string) => {
  try {
    localStorage.setItem(VIEWED, JSON.stringify([sku, ...readViewed().filter((x) => x !== sku)].slice(0, 12)))
  } catch {}
}

/** Re-renders every second so "Updated 4s ago" stays true. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export const ago = (from: number, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - from) / 1000))
  return s < 5 ? 'just now' : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86_400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86_400)} d ago`
}

/** "Updated 4s ago", as text, ticking. */
export function Updated({ at }: { at?: number }) {
  const now = useNow()
  return <span className="fine">{at ? `Updated ${ago(at, now)}` : 'Not updated yet'}</span>
}

/** A small "What's this?" disclosure that works on tap and keyboard, not on hover. */
export function Define({ term, children }: { term: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <span className="define">
      <button type="button" className="define-btn" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        What’s this?<span className="sr"> {term}</span>
      </button>
      {open && (
        <span id={id} role="note" className="define-body">
          {children}
        </span>
      )}
    </span>
  )
}

/** Best offer, ask and last sale on one scale. The gap between offer and ask is shaded neutral, and one sentence says what it is. */
export function SpreadBar({ bid, ask, last }: { bid?: bigint; ask?: bigint; last?: bigint }) {
  const sp = spread(ask, bid)
  const sentence =
    ask === undefined && bid === undefined
      ? 'No one is selling and no one is offering yet.'
      : ask === undefined
        ? 'No one is selling at this grade.'
        : bid === undefined
          ? 'No offers yet.'
          : sp && sp.cents === 0n
            ? 'The best offer equals the ask.'
            : sp && sp.cents < 0n
              ? `The best offer is ${formatBps(-sp.bps, { digits: 1 })} above the ask.`
              : `Best offer is ${formatBps(sp!.bps, { digits: 1 })} below the ask.`
  const marks = [
    bid !== undefined && { k: 'bid', label: 'Best offer', v: bid },
    ask !== undefined && { k: 'ask', label: 'Ask', v: ask },
    last !== undefined && { k: 'last', label: 'Last sale', v: last },
  ].filter(Boolean) as { k: string; label: string; v: bigint }[]
  if (!marks.length) return <p className="fine spread-sentence">{sentence}</p>
  const lo = marks.reduce((m, x) => (x.v < m ? x.v : m), marks[0].v)
  const hi = marks.reduce((m, x) => (x.v > m ? x.v : m), marks[0].v)
  const pad = (hi - lo) / 6n || hi / 20n || 1n
  const min = lo - pad
  const span = Number(hi + pad - min) || 1
  const pos = (v: bigint) => `${(Number(v - min) / span) * 100}%`
  // Marks at the same price share one label; marks close together alternate above and below the track.
  const groups: { v: bigint; labels: string[] }[] = []
  for (const m of [...marks].sort((a, b) => (a.v < b.v ? -1 : 1))) {
    const g = groups.find((x) => x.v === m.v)
    g ? g.labels.push(m.label) : groups.push({ v: m.v, labels: [m.label] })
  }
  return (
    <div className="spread" role="group" aria-label="Spread">
      <div className="spread-track">
        {bid !== undefined && ask !== undefined && ask > bid && <i className="spread-gap" style={{ left: pos(bid), width: `${(Number(ask - bid) / span) * 100}%` }} aria-hidden />}
        {groups.map((g, i) => (
          <span key={String(g.v)} className={`spread-tick ${i % 2 ? 'tick-below' : 'tick-above'}`} style={{ left: pos(g.v) }}>
            <em>
              {g.labels.join(' and ')} {usdC(g.v)}
            </em>
          </span>
        ))}
      </div>
      <p className="fine spread-sentence">{sentence}</p>
    </div>
  )
}

/** The first time someone meets the ask, the best offer and the spread, once, and never again once dismissed. */
export function FirstHint() {
  const [off, setOff] = useState(() => localStorage.getItem('tivan.hint.market') === '1')
  if (off) return null
  return (
    <div className="notice hint" role="note">
      <b>New here?</b> The ask is the lowest price anyone is selling at. The best offer is the highest price anyone is bidding. The spread is the gap between them.{' '}
      <button className="linkbtn" onClick={() => { try { localStorage.setItem('tivan.hint.market', '1') } catch {} setOff(true) }}>Got it</button>
    </div>
  )
}
