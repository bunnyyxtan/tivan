import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { explorerTx } from './chain'
import { Opt, Seg } from './controls'
import { RANGES, bucketFor, bucketOHLC, inRange, summary, type Range, type Trade } from './logic/chartMath.ts'
import { formatQty } from './logic/money.ts'
import { Updated, usdC } from './cardParts'

// Trades as points joined by a step line, because a price holds until the next trade. Nothing is interpolated, smoothed or invented;
// a long stretch without trades stays visible as a dashed hold. Drawn on a canvas, loaded only when the card page needs it.

type Item = { t: number; price: bigint; size: bigint; hash?: string; ohlc?: { open: bigint; high: bigint; low: bigint; close: bigint; n: number } }
const PAD = { l: 68, r: 18, t: 14, b: 30 }
const VOL = 38

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

function niceTicks(lo: number, hi: number, n: number): number[] {
  const raw = (hi - lo) / Math.max(1, n)
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v))
  return out
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

  const dom: [number, number] = zoom ?? [items.length ? items[0].t : now - 86_400, Math.max(now, items.at(-1)?.t ?? now)]
  const vis = items.filter((x) => x.t >= dom[0] && x.t <= dom[1])
  const label = range === 'All' ? 'in all recorded trades' : `in the last ${range === '1D' ? 'day' : range === '1W' ? 'week' : range === '1M' ? 'month' : range === '3M' ? '3 months' : 'year'}`

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.max(280, Math.round(e.contentRect.width)), h: e.contentRect.width < 520 ? 260 : 340 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
    const padv = Math.max(Number(hi - lo) * 0.12, Number(hi) * 0.01, 1)
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
    const ink = css('--text-secondary')
    const grid = css('--border-subtle')
    const accent = css('--accent-text')
    const strong = css('--border-strong')
    g.font = '12px ' + css('--font-sans')
    g.textBaseline = 'middle'
    const { x, y, yLo, yHi, H, W } = geo
    // price axis
    g.textAlign = 'right'
    for (const v of niceTicks(yLo, yHi, 4)) {
      g.strokeStyle = grid
      g.lineWidth = 1
      g.beginPath()
      g.moveTo(PAD.l, y(v) + 0.5)
      g.lineTo(PAD.l + W, y(v) + 0.5)
      g.stroke()
      g.fillStyle = ink
      g.fillText(usdC(BigInt(v)), PAD.l - 8, y(v))
    }
    // time axis, in the viewer's time zone
    g.textAlign = 'center'
    g.fillStyle = ink
    const fmt = new Intl.DateTimeFormat(undefined, dom[1] - dom[0] < 3 * 86_400 ? { hour: 'numeric', minute: '2-digit' } : dom[1] - dom[0] > 400 * 86_400 ? { month: 'short', year: 'numeric' } : { month: 'short', day: 'numeric' })
    for (let i = 0; i < 4; i++) {
      const t = dom[0] + ((dom[1] - dom[0]) * i) / 3
      g.fillText(fmt.format(new Date(t * 1000)), Math.min(Math.max(x(t), PAD.l + 24), PAD.l + W - 24), PAD.t + H + (volume ? VOL : 0) + 16)
    }
    // volume bars along the base
    if (volume && vis.length) {
      const top = PAD.t + H + 6
      const maxV = Number(vis.reduce((m, v) => (v.size > m ? v.size : m), 1n))
      g.fillStyle = strong
      for (const it of vis) g.fillRect(x(it.t) - 2, top + VOL - 6 - (Number(it.size) / maxV) * (VOL - 10), 4, (Number(it.size) / maxV) * (VOL - 10) + 1)
    }
    // overlays: current ask and best offer as labelled lines
    if (lines)
      for (const [v, name] of [[askCents, 'Ask'], [bidCents, 'Best offer']] as const) {
        if (v === undefined) continue
        g.save()
        g.setLineDash([5, 4])
        g.strokeStyle = ink
        g.beginPath()
        g.moveTo(PAD.l, y(Number(v)) + 0.5)
        g.lineTo(PAD.l + W, y(Number(v)) + 0.5)
        g.stroke()
        g.restore()
        g.textAlign = 'right'
        g.fillStyle = css('--text-primary')
        g.fillText(`${name} ${usdC(v)}`, PAD.l + W - 4, y(Number(v)) + (name === 'Ask' ? -9 : 11))
      }
    if (vis.length === 0) return
    const first = vis[0]
    const last = vis[vis.length - 1]
    // gradient 2 of 3: the line colour fading into a translucent fill that reaches transparent at the baseline
    if (!width) {
      const grad = g.createLinearGradient(0, PAD.t, 0, PAD.t + H)
      grad.addColorStop(0, css('--chart-fill-top'))
      grad.addColorStop(1, css('--chart-fill-bottom'))
      g.fillStyle = grad
      g.beginPath()
      g.moveTo(x(first.t), PAD.t + H)
      vis.forEach((it, i) => {
        if (i) g.lineTo(x(it.t), y(Number(vis[i - 1].price)))
        g.lineTo(x(it.t), y(Number(it.price)))
      })
      g.lineTo(x(dom[1]), y(Number(last.price)))
      g.lineTo(x(dom[1]), PAD.t + H)
      g.closePath()
      g.fill()
      // the step line: solid between close trades, dashed over a long stretch with no trades
      g.strokeStyle = accent
      g.lineWidth = 2
      const longGap = Math.max(86_400, (dom[1] - dom[0]) * 0.15)
      let px = x(first.t)
      let py = y(Number(first.price))
      vis.forEach((it, i) => {
        if (!i) return
        const gap = it.t - vis[i - 1].t
        g.save()
        g.setLineDash(gap > longGap ? [6, 5] : [])
        g.beginPath()
        g.moveTo(px, py)
        g.lineTo(x(it.t), py)
        g.stroke()
        g.restore()
        g.beginPath()
        g.moveTo(x(it.t), py)
        g.lineTo(x(it.t), y(Number(it.price)))
        g.stroke()
        px = x(it.t)
        py = y(Number(it.price))
      })
      g.save()
      g.setLineDash(dom[1] - last.t > longGap ? [6, 5] : [])
      g.beginPath()
      g.moveTo(px, py)
      g.lineTo(x(dom[1]), py)
      g.stroke()
      g.restore()
      g.fillStyle = accent
      for (const it of vis) {
        g.beginPath()
        g.arc(x(it.t), y(Number(it.price)), 3, 0, Math.PI * 2)
        g.fill()
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
    // last-sale marker, labelled
    const lx = x(last.t)
    const ly = y(Number(last.price))
    g.fillStyle = css('--canvas')
    g.strokeStyle = accent
    g.lineWidth = 2
    g.beginPath()
    g.arc(lx, ly, fresh ? 8 : 5, 0, Math.PI * 2)
    g.fill()
    g.stroke()
    g.fillStyle = css('--text-primary')
    g.textAlign = lx > PAD.l + W - 120 ? 'right' : 'left'
    g.fillText(`Last sale ${usdC(last.price)}`, lx + (lx > PAD.l + W - 120 ? -12 : 12), ly - 14)
    // crosshair and pinned trade
    for (const idx of [pinned, hover]) {
      const it = idx !== undefined ? vis[idx] : undefined
      if (!it) continue
      g.strokeStyle = idx === pinned ? accent : ink
      g.lineWidth = 1
      g.save()
      g.setLineDash(idx === pinned ? [] : [3, 3])
      g.beginPath()
      g.moveTo(x(it.t) + 0.5, PAD.t)
      g.lineTo(x(it.t) + 0.5, PAD.t + H)
      g.moveTo(PAD.l, y(Number(it.price)) + 0.5)
      g.lineTo(PAD.l + W, y(Number(it.price)) + 0.5)
      g.stroke()
      g.restore()
      g.fillStyle = css('--canvas')
      g.strokeStyle = accent
      g.lineWidth = 2
      g.beginPath()
      g.arc(x(it.t), y(Number(it.price)), 6, 0, Math.PI * 2)
      g.fill()
      g.stroke()
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
  const tip = idx && { left: Math.min(Math.max(geo.x(idx.t), 90), size.w - 90), top: Math.max(8, geo.y(Number(idx.price)) - 12) }
  const when = (t: number) => new Date(t * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div className="pchart">
      <div className="hist-head">
        <Seg label="Range" value={range} onChange={(r) => (setRange(r), setZoom(undefined), setHover(undefined), setPinned(undefined))} options={RANGES.map((r) => ({ value: r, label: r }))} />
        <span className="pchart-toggles">
          <Opt type="checkbox" checked={lines} onChange={setLines} label="Ask and best offer" />
          <Opt type="checkbox" checked={volume} onChange={setVolume} label="Volume" />
        </span>
      </div>
      <p className="fine" role="status">
        {summary(pts, usdC, label)} Prices in dollars, times in {tz}. <Updated at={updatedAt} />
        {fresh ? ` ${fresh}.` : ''}
      </p>
      {pts.length < 2 ? (
        <div className="pchart-list">
          <p className="fine">{pts.length === 0 ? 'No trades in this range yet. A chart needs at least two trades, and we do not draw lines between guesses.' : 'Only one trade in this range, so there is nothing to join into a line. It is listed here.'}</p>
          {pts.map((x, i) => (
            <p key={i} className="mono">
              {usdC(x.price)} × {formatQty(x.size)} · {when(x.t)}
            </p>
          ))}
        </div>
      ) : (
        <>
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
              <div className="pchart-tip" style={{ left: tip.left, top: tip.top }}>
                <b>{idx.ohlc ? `Open ${usdC(idx.ohlc.open)} · High ${usdC(idx.ohlc.high)} · Low ${usdC(idx.ohlc.low)} · Close ${usdC(idx.ohlc.close)}` : usdC(idx.price)}</b>
                <span>
                  {formatQty(idx.size)} {idx.ohlc ? `traded in ${idx.ohlc.n} trades` : idx.size === 1n ? 'card' : 'cards'}
                </span>
                <span>
                  {when(idx.t)} ({tz})
                </span>
                {idx.hash && (
                  <a className="u" href={explorerTx(idx.hash)} target="_blank" rel="noreferrer">
                    View trade
                  </a>
                )}
                {pinned !== undefined && vis[pinned] === idx && <span className="fine">Pinned. Press Enter to unpin.</span>}
              </div>
            )}
          </div>
          <p className="fine">Ctrl or Cmd with scroll, or plus and minus, zooms. Drag pans when zoomed. Touch and drag scrubs. {width ? `Showing ${width === 'day' ? 'daily' : 'hourly'} candles because there are many trades.` : ''}</p>
          <div className="pchart-actions">
            {zoom && (
              <button className="ghost line s32" onClick={() => setZoom(undefined)}>
                Reset zoom
              </button>
            )}
            <button className="ghost s32" aria-pressed={table} onClick={() => setTable(!table)}>
              {table ? 'Hide data table' : 'Show data table'}
            </button>
          </div>
        </>
      )}
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
                <td className="num">{usdC(x.price)}</td>
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

