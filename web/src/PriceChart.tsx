import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { explorerTx } from './chain'
import { Seg } from './controls'
import { RANGES, bucketFor, bucketOHLC, inRange, summary, type Range, type Trade } from './logic/chartMath.ts'
import { formatBps, formatQty } from './logic/money.ts'
import { Updated, usdC } from './cardParts'

// Trades as points joined by a step line, because a price holds until the next trade. Nothing is interpolated, smoothed or
// invented; the stretch from the last trade to now is drawn dotted. Prices sit on the right axis, with the last sale, the
// lowest ask and the best offer marked there, as trading screens do. Dense ranges switch to OHLC candles.

type Item = { t: number; price: bigint; size: bigint; hash?: string; ohlc?: { open: bigint; high: bigint; low: bigint; close: bigint; n: number } }
const PAD = { l: 12, r: 92, t: 18, b: 32 }
const VOL = 44

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function niceTicks(lo: number, hi: number, n: number): number[] {
  const raw = (hi - lo) / Math.max(1, n)
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v))
  return out
}

// Time ticks on round local boundaries (on the hour, at midnight, on Mondays...), about `n` of them.
const STEPS = [300, 900, 1800, 3600, 3 * 3600, 6 * 3600, 12 * 3600, 86_400, 2 * 86_400, 7 * 86_400, 14 * 86_400, 30 * 86_400, 91 * 86_400, 182 * 86_400, 365 * 86_400]
function timeTicks(a: number, b: number, n: number) {
  const step = STEPS.find((s) => (b - a) / s <= n) ?? STEPS[STEPS.length - 1]
  const off = new Date(a * 1000).getTimezoneOffset() * 60
  const out: number[] = []
  for (let t = Math.ceil((a - off) / step) * step + off; t <= b; t += step) out.push(t)
  return { step, ticks: out }
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
}

export default function PriceChart({ trades, askCents, bidCents, updatedAt }: { trades: Trade[]; askCents?: bigint; bidCents?: bigint; updatedAt?: number }) {
  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])
  const [range, setRange] = useState<Range>('All')
  const [zoom, setZoom] = useState<[number, number]>()
  const [hover, setHover] = useState<number>()
  const [pinned, setPinned] = useState<number>()
  const [lines, setLines] = useState(true)
  const [volume, setVolume] = useState(true)
  const [table, setTable] = useState(false)
  const [fresh, setFresh] = useState<string>()
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 640, h: 340 })
  const drag = useRef<{ x: number; a: number; b: number } | undefined>(undefined)
  const prevLast = useRef<number | undefined>(undefined)

  const now = useMemo(() => Math.floor(Date.now() / 1000), [trades, range])
  const pts = useMemo(() => inRange(trades, range, now), [trades, range, now])
  const width = bucketFor(range, pts.length)
  const items: Item[] = useMemo(() => {
    if (!width) return pts.map((x) => ({ t: x.t, price: x.price, size: x.size, hash: x.hash }))
    return bucketOHLC(pts, width, tz).map((c) => ({ t: c.t, price: c.close, size: c.volume, ohlc: { open: c.open, high: c.high, low: c.low, close: c.close, n: c.n } }))
  }, [pts, width, tz])

  // The view runs from a little before the first trade to now, so the first point never sits on the edge.
  const span0 = Math.max(3600, now - (items[0]?.t ?? now - 86_400))
  const dom: [number, number] = zoom ?? [(items[0]?.t ?? now - 86_400) - span0 * 0.04, now + span0 * 0.01]
  const vis = items.filter((x) => x.t >= dom[0] && x.t <= dom[1])
  const label = range === 'All' ? 'in all recorded trades' : `in the last ${range === '1D' ? 'day' : range === '1W' ? 'week' : range === '1M' ? 'month' : range === '3M' ? '3 months' : 'year'}`

  // Figures for the strip above the chart, from the trades in range.
  const stats = useMemo(() => {
    if (!pts.length) return undefined
    const first = pts[0].price
    const last = pts[pts.length - 1].price
    const hi = pts.reduce((m, x) => (x.price > m ? x.price : m), first)
    const lo = pts.reduce((m, x) => (x.price < m ? x.price : m), first)
    const vol = pts.reduce((m, x) => m + x.size, 0n)
    return { first, last, hi, lo, vol, n: pts.length, bps: first > 0n ? ((last - first) * 10_000n) / first : 0n }
  }, [pts])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(280, Math.round(e.contentRect.width)), h: e.contentRect.width < 520 ? 280 : 360 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [pts.length < 2])

  // A trade that arrives while the page is open is announced as text and the last point is ringed.
  useEffect(() => {
    const last = trades.at(-1)
    if (last && prevLast.current !== undefined && last.t > prevLast.current) {
      setFresh(`New trade at ${usdC(last.price)}`)
      const id = setTimeout(() => setFresh(undefined), 5000)
      prevLast.current = last.t
      return () => clearTimeout(id)
    }
    prevLast.current = last?.t
  }, [trades])

  const geo = useMemo(() => {
    const prices = vis.flatMap((x) => (x.ohlc ? [x.ohlc.low, x.ohlc.high] : [x.price]))
    if (lines) for (const v of [askCents, bidCents]) if (v !== undefined) prices.push(v)
    const lo = prices.length ? prices.reduce((m, v) => (v < m ? v : m)) : 0n
    const hi = prices.length ? prices.reduce((m, v) => (v > m ? v : m)) : 1n
    const padv = Math.max(Number(hi - lo) * 0.18, Number(hi) * 0.02, 1)
    const yLo = Math.max(0, Number(lo) - padv)
    const yHi = Number(hi) + padv
    const W = size.w - PAD.l - PAD.r
    const H = size.h - PAD.t - PAD.b - (volume ? VOL : 0)
    const x = (t: number) => PAD.l + ((t - dom[0]) / Math.max(1, dom[1] - dom[0])) * W
    const y = (p: number) => PAD.t + (1 - (p - yLo) / Math.max(1, yHi - yLo)) * H
    return { yLo, yHi, W, H, x, y }
  }, [vis, lines, askCents, bidCents, size, volume, dom[0], dom[1]])

  const sel = hover ?? pinned
  const selItem = sel !== undefined ? vis[sel] : undefined

  // ---- drawing
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    c.width = size.w * dpr
    c.height = size.h * dpr
    const g = c.getContext('2d')!
    g.scale(dpr, dpr)
    g.clearRect(0, 0, size.w, size.h)
    const ink3 = css('--text-tertiary')
    const ink1 = css('--text-primary')
    const grid = css('--border-subtle')
    const accent = css('--accent-text')
    const surface = css('--surface-1')
    const mono = css('--font-mono')
    const { x, y, yLo, yHi, H, W } = geo
    const right = PAD.l + W
    const base = PAD.t + H

    // Markers on the right axis: last sale (filled), ask and best offer (outlined, with a coloured dot).
    type Mark = { v: number; text: string; fill?: string; dot?: string; y: number }
    const marks: Mark[] = []
    const last = vis[vis.length - 1]
    if (last) marks.push({ v: Number(last.price), text: usdC(last.price), fill: accent, y: y(Number(last.price)) })
    if (lines && askCents !== undefined) marks.push({ v: Number(askCents), text: usdC(askCents), dot: css('--negative'), y: y(Number(askCents)) })
    if (lines && bidCents !== undefined) marks.push({ v: Number(bidCents), text: usdC(bidCents), dot: css('--positive'), y: y(Number(bidCents)) })
    // Nudge markers apart so their labels never overlap.
    const byY = [...marks].sort((a, b) => a.y - b.y)
    for (let i = 1; i < byY.length; i++) if (byY[i].y - byY[i - 1].y < 22) byY[i].y = byY[i - 1].y + 22

    // price grid and axis labels, skipping labels a marker covers
    g.font = `11px ${mono}`
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    for (const v of niceTicks(yLo, yHi, 4)) {
      const yy = Math.round(y(v)) + 0.5
      if (yy < PAD.t || yy > base) continue
      g.strokeStyle = grid
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(PAD.l, yy)
      g.lineTo(right, yy)
      g.stroke()
      if (marks.some((m) => Math.abs(m.y - yy) < 14)) continue
      g.fillStyle = ink3
      g.fillText(usdC(BigInt(v)), right + 12, yy)
    }

    // time axis on round local boundaries
    const { step, ticks } = timeTicks(dom[0], dom[1], Math.max(3, Math.floor(W / 120)))
    const fmt = (t: number) => {
      const d = new Date(t * 1000)
      if (step >= 30 * 86_400) return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      if (step >= 86_400 || (d.getHours() === 0 && d.getMinutes() === 0)) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    }
    const axisY = base + (volume ? VOL : 0)
    g.strokeStyle = grid
    g.beginPath()
    g.moveTo(PAD.l, axisY + 0.5)
    g.lineTo(right, axisY + 0.5)
    g.stroke()
    g.textAlign = 'center'
    g.font = `11px ${css('--font-sans')}`
    for (const t of ticks) {
      const xx = Math.round(x(t)) + 0.5
      if (xx < PAD.l + 20 || xx > right - 20) continue
      g.strokeStyle = grid
      g.beginPath()
      g.moveTo(xx, axisY)
      g.lineTo(xx, axisY + 5)
      g.stroke()
      g.fillStyle = ink3
      g.fillText(fmt(t), xx, axisY + 18)
    }

    // volume bars along the base
    if (volume && vis.length) {
      const top = base + 10
      const maxV = Number(vis.reduce((m, v) => (v.size > m ? v.size : m), 1n))
      const bw = Math.max(3, Math.min(10, (W / Math.max(1, vis.length)) * 0.5))
      g.fillStyle = accent
      g.globalAlpha = 0.28
      for (const it of vis) {
        const h = Math.max(3, (Number(it.size) / maxV) * (VOL - 16))
        roundRect(g, x(it.t) - bw / 2, top + (VOL - 14) - h, bw, h, 2)
        g.fill()
      }
      g.globalAlpha = 1
    }

    // ask and best offer: a faint line in their colour
    for (const m of marks) {
      if (!m.dot) continue
      g.strokeStyle = m.dot
      g.globalAlpha = 0.45
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(PAD.l, Math.round(y(m.v)) + 0.5)
      g.lineTo(right, Math.round(y(m.v)) + 0.5)
      g.stroke()
      g.globalAlpha = 1
    }

    if (vis.length) {
      const first = vis[0]
      if (!width) {
        // area under the step line
        const grad = g.createLinearGradient(0, PAD.t, 0, base)
        grad.addColorStop(0, css('--chart-fill-top'))
        grad.addColorStop(1, css('--chart-fill-bottom'))
        g.fillStyle = grad
        g.beginPath()
        g.moveTo(x(first.t), base)
        vis.forEach((it, i) => {
          if (i) g.lineTo(x(it.t), y(Number(vis[i - 1].price)))
          g.lineTo(x(it.t), y(Number(it.price)))
        })
        g.lineTo(x(dom[1]), y(Number(last.price)))
        g.lineTo(x(dom[1]), base)
        g.closePath()
        g.fill()
        // the step line between trades
        g.strokeStyle = accent
        g.lineWidth = 2
        g.lineJoin = 'round'
        g.beginPath()
        g.moveTo(x(first.t), y(Number(first.price)))
        vis.forEach((it, i) => {
          if (!i) return
          g.lineTo(x(it.t), y(Number(vis[i - 1].price)))
          g.lineTo(x(it.t), y(Number(it.price)))
        })
        g.stroke()
        // from the last trade to now, the price holds: dotted
        g.save()
        g.setLineDash([2, 5])
        g.lineCap = 'round'
        g.beginPath()
        g.moveTo(x(last.t), y(Number(last.price)))
        g.lineTo(x(dom[1]), y(Number(last.price)))
        g.stroke()
        g.restore()
        // each trade as a dot
        if (vis.length <= 80)
          for (const it of vis) {
            g.beginPath()
            g.arc(x(it.t), y(Number(it.price)), 3.5, 0, Math.PI * 2)
            g.fillStyle = surface
            g.fill()
            g.lineWidth = 2
            g.strokeStyle = accent
            g.stroke()
          }
      } else {
        // dense ranges: OHLC candles. A filled body closed up, a hollow body closed down, so colour is never the only signal.
        g.lineWidth = 1.5
        g.strokeStyle = accent
        g.fillStyle = accent
        const cw = Math.max(3, Math.min(14, (W / Math.max(1, vis.length)) * 0.6))
        for (const it of vis) {
          const o = it.ohlc!
          g.beginPath()
          g.moveTo(x(it.t), y(Number(o.high)))
          g.lineTo(x(it.t), y(Number(o.low)))
          g.stroke()
          const top = y(Number(o.close > o.open ? o.close : o.open))
          const h = Math.max(1.5, Math.abs(y(Number(o.close)) - y(Number(o.open))))
          o.close >= o.open ? g.fillRect(x(it.t) - cw / 2, top, cw, h) : g.strokeRect(x(it.t) - cw / 2, top, cw, h)
        }
      }
      // the last sale, ringed (larger when it just arrived)
      g.beginPath()
      g.arc(x(last.t), y(Number(last.price)), fresh ? 9 : 6, 0, Math.PI * 2)
      g.fillStyle = accent
      g.globalAlpha = 0.18
      g.fill()
      g.globalAlpha = 1
      g.beginPath()
      g.arc(x(last.t), y(Number(last.price)), 4, 0, Math.PI * 2)
      g.fillStyle = accent
      g.fill()
    }

    // crosshair for the hovered or pinned trade
    for (const idx of [pinned, hover]) {
      const it = idx !== undefined ? vis[idx] : undefined
      if (!it) continue
      const xx = Math.round(x(it.t)) + 0.5
      g.strokeStyle = ink3
      g.lineWidth = 1
      g.save()
      g.setLineDash([3, 3])
      g.beginPath()
      g.moveTo(xx, PAD.t)
      g.lineTo(xx, axisY)
      g.stroke()
      g.restore()
      g.beginPath()
      g.arc(xx, y(Number(it.price)), 6, 0, Math.PI * 2)
      g.fillStyle = surface
      g.fill()
      g.lineWidth = 2.5
      g.strokeStyle = accent
      g.stroke()
    }

    // right-axis markers last, over everything
    g.font = `600 11px ${mono}`
    g.textAlign = 'left'
    for (const m of marks) {
      const tw = g.measureText(m.text).width
      const w = tw + (m.dot ? 26 : 16)
      const bx = right + 6
      const by = Math.min(Math.max(m.y, PAD.t + 10), axisY - 10) - 10
      roundRect(g, bx, by, w, 20, 6)
      if (m.fill) {
        g.fillStyle = m.fill
        g.fill()
        g.fillStyle = css('--canvas')
        g.fillText(m.text, bx + 8, by + 10.5)
      } else {
        g.fillStyle = surface
        g.fill()
        g.strokeStyle = m.dot!
        g.lineWidth = 1
        g.stroke()
        g.beginPath()
        g.arc(bx + 9, by + 10, 3, 0, Math.PI * 2)
        g.fillStyle = m.dot!
        g.fill()
        g.fillStyle = ink1
        g.fillText(m.text, bx + 17, by + 10.5)
      }
    }
  }, [geo, vis, size, lines, volume, askCents, bidCents, hover, pinned, width, fresh, dom[0], dom[1]])

  // ---- interaction
  const nearest = useCallback(
    (clientX: number) => {
      const r = canvas.current!.getBoundingClientRect()
      const t = dom[0] + ((clientX - r.left - PAD.l) / geo.W) * (dom[1] - dom[0])
      let best = 0
      let bd = Infinity
      vis.forEach((it, i) => {
        const d = Math.abs(it.t - t)
        if (d < bd) (bd = d), (best = i)
      })
      return vis.length ? best : undefined
    },
    [vis, geo.W, dom[0], dom[1]],
  )
  const pan = (dx: number, base: { a: number; b: number }) => {
    const per = (base.b - base.a) / geo.W
    setZoom([base.a - dx * per, base.b - dx * per])
  }
  const zoomBy = (factor: number, anchor: number) => {
    const span = dom[1] - dom[0]
    const ns = Math.max(600, span * factor)
    const k = (anchor - dom[0]) / span
    setZoom([anchor - k * ns, anchor + (1 - k) * ns])
  }
  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key
    const cur = sel ?? (vis.length - 1)
    if (k === 'ArrowLeft' || k === 'ArrowRight') (e.preventDefault(), setHover(Math.max(0, Math.min(vis.length - 1, cur + (k === 'ArrowRight' ? 1 : -1)))))
    else if (k === 'Home') (e.preventDefault(), setHover(0))
    else if (k === 'End') (e.preventDefault(), setHover(vis.length - 1))
    else if (k === 'Enter' || k === ' ') (e.preventDefault(), setPinned(pinned === cur ? undefined : cur))
    else if (k === 'Escape') (setPinned(undefined), setHover(undefined))
    else if (k === '+' || k === '=') zoomBy(0.6, (dom[0] + dom[1]) / 2)
    else if (k === '-') zoomBy(1.6, (dom[0] + dom[1]) / 2)
    else if (k === '0') setZoom(undefined)
  }

  const idx = selItem
  // A hovered tooltip ignores the mouse, so it never steals the hover and flickers. A pinned one takes clicks for its link.
  const pinnedHere = pinned !== undefined && vis[pinned] === idx
  // The tooltip sits above the point, or below it when the point is near the top, and never past the sides.
  const tip = idx && (() => {
    const py = geo.y(Number(idx.price))
    return { left: Math.min(Math.max(geo.x(idx.t), 110), size.w - PAD.r - 100), top: py, below: py < 110 }
  })()
  const when = (t: number) => new Date(t * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  const up = stats && stats.bps > 0n
  const down = stats && stats.bps < 0n

  return (
    <div className="pchart">
      <dl className="pc-stats">
        <div className="lead">
          <dt>Last sale</dt>
          <dd>
            {stats ? usdC(stats.last, 2) : '—'}
            {stats && stats.n > 1 && (
              <span className={`pc-delta ${up ? 'up' : down ? 'down' : ''}`}>
                {up ? '▲' : down ? '▼' : ''} {formatBps(stats.bps < 0n ? -stats.bps : stats.bps)}
              </span>
            )}
          </dd>
        </div>
        <div><dt>High</dt><dd>{stats ? usdC(stats.hi, 2) : '—'}</dd></div>
        <div><dt>Low</dt><dd>{stats ? usdC(stats.lo, 2) : '—'}</dd></div>
        <div><dt>Trades</dt><dd>{stats ? stats.n.toLocaleString('en-US') : '0'}</dd></div>
        <div><dt>Cards traded</dt><dd>{stats ? formatQty(stats.vol) : '0'}</dd></div>
      </dl>
      <div className="pc-bar">
        <Seg label="Range" value={range} onChange={(r) => (setRange(r), setZoom(undefined), setHover(undefined), setPinned(undefined))} options={RANGES.map((r) => ({ value: r, label: r }))} />
        <span className="pc-toggles">
          <button className="pc-tog" aria-pressed={lines} onClick={() => setLines(!lines)}>
            <i className="ask" aria-hidden />
            <i className="bid" aria-hidden />
            Ask and best offer
          </button>
          <button className="pc-tog" aria-pressed={volume} onClick={() => setVolume(!volume)}>
            <i className="vol" aria-hidden />
            Volume
          </button>
          {zoom && <button className="pc-tog" onClick={() => setZoom(undefined)}>Reset zoom</button>}
        </span>
      </div>
      <p className="sr" role="status">
        {summary(pts, usdC, label)} Prices in dollars, times in {tz}.{fresh ? ` ${fresh}.` : ''}
      </p>
      {pts.length < 2 ? (
        <div className="pc-empty">
          <b>{pts.length === 0 ? 'No trades in this range yet' : 'One trade in this range'}</b>
          <p className="fine">{pts.length === 0 ? 'A line needs at least two trades, and we do not draw lines between guesses. Try a longer range.' : 'There is nothing to join into a line yet, so the trade is listed here.'}</p>
          {pts.map((x, i) => (
            <p key={i} className="pc-one">
              <b>{usdC(x.price, 2)}</b> × {formatQty(x.size)} · {when(x.t)}
              {x.hash && <> · <a className="u" href={explorerTx(x.hash)} target="_blank" rel="noreferrer">View trade</a></>}
            </p>
          ))}
        </div>
      ) : (
        <div
          className="pchart-box"
          ref={box}
          tabIndex={0}
          role="group"
          aria-label="Price history chart. Use the left and right arrow keys to step between trades, Home and End to jump to the ends, Enter to pin a trade, plus and minus to zoom, zero to reset."
          onKeyDown={onKey}
          onBlur={() => setHover(undefined)}
        >
          <canvas
            ref={canvas}
            style={{ width: size.w, height: size.h, touchAction: 'pan-y' }}
            aria-hidden
            onPointerMove={(e) => {
              if (drag.current && e.pointerType === 'mouse') return pan(e.clientX - drag.current.x, drag.current)
              if (e.pointerType !== 'mouse' && e.buttons === 0) return
              setHover(nearest(e.clientX))
            }}
            onPointerLeave={() => setHover(undefined)}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && zoom) (drag.current = { x: e.clientX, a: dom[0], b: dom[1] }), e.currentTarget.setPointerCapture(e.pointerId)
              else setHover(nearest(e.clientX))
            }}
            onPointerUp={(e) => {
              const moved = drag.current && Math.abs(e.clientX - drag.current.x) > 4
              drag.current = undefined
              if (!moved) {
                const i = nearest(e.clientX)
                setPinned(pinned === i ? undefined : i)
              }
            }}
            onWheel={(e) => {
              if (!(e.ctrlKey || e.metaKey)) return
              e.preventDefault()
              const r = canvas.current!.getBoundingClientRect()
              zoomBy(e.deltaY > 0 ? 1.25 : 0.8, dom[0] + ((e.clientX - r.left - PAD.l) / geo.W) * (dom[1] - dom[0]))
            }}
          />
          {idx && tip && (
            <div className={`pchart-tip ${tip.below ? 'below' : ''} ${pinnedHere ? 'pinned' : ''}`} style={{ left: tip.left, top: tip.top }}>
              {idx.ohlc ? (
                <dl className="pc-ohlc">
                  <div><dt>Open</dt><dd>{usdC(idx.ohlc.open, 2)}</dd></div>
                  <div><dt>High</dt><dd>{usdC(idx.ohlc.high, 2)}</dd></div>
                  <div><dt>Low</dt><dd>{usdC(idx.ohlc.low, 2)}</dd></div>
                  <div><dt>Close</dt><dd>{usdC(idx.ohlc.close, 2)}</dd></div>
                </dl>
              ) : (
                <b>{usdC(idx.price, 2)}</b>
              )}
              <span>
                {formatQty(idx.size)} {idx.ohlc ? `cards in ${idx.ohlc.n} trades` : idx.size === 1n ? 'card' : 'cards'} · {when(idx.t)}
              </span>
              {pinnedHere ? (
                idx.hash && (
                  <a className="u" href={explorerTx(idx.hash)} target="_blank" rel="noreferrer">
                    View this trade on the explorer
                  </a>
                )
              ) : (
                <small className="pc-hint">Click to pin{idx.hash ? ' and open the transaction' : ''}</small>
              )}
            </div>
          )}
        </div>
      )}
      <div className="pc-foot">
        <span className="fine">
          Times in {tz}. <Updated at={updatedAt} />
          {width ? ` ${width === 'day' ? 'Daily' : 'Hourly'} candles, because there are many trades.` : ''}
        </span>
        {pts.length > 0 && (
          <button className="linkbtn" aria-pressed={table} onClick={() => setTable(!table)}>
            {table ? 'Hide the trades table' : 'Show the trades table'}
          </button>
        )}
      </div>
      {table && pts.length > 0 && (
        <table className="booktable" aria-label="Trades in this range">
          <thead>
            <tr>
              <th scope="col">Time ({tz})</th>
              <th scope="col" className="num">Price</th>
              <th scope="col" className="num">Cards</th>
              <th scope="col">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {[...pts].reverse().slice(0, 200).map((x, i) => (
              <tr key={i}>
                <td>{when(x.t)}</td>
                <td className="num">{usdC(x.price, 2)}</td>
                <td className="num">{formatQty(x.size)}</td>
                <td>
                  {x.hash ? (
                    <a className="u" href={explorerTx(x.hash)} target="_blank" rel="noreferrer">
                      View
                    </a>
                  ) : (
                    <span className="na">Not recorded</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
