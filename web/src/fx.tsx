import { createElement, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'

// ---- preferences: motion level, background, list density and view. Saved in this browser, applied as <html> attributes.
export type Skin = 'card' | 'neutral' | 'char' | 'pika' | 'lbj' | 'mj' | 'lotus' | 'blue' | 'green'
export type Prefs = { motion: 'full' | 'calm' | 'off'; aurora: boolean; dense: boolean; view: 'list' | 'grid'; skin: Skin }
const KEY = 'tivan.prefs'
const defaults = (): Prefs => ({ motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'full', aurora: true, dense: false, view: 'grid', skin: 'card' })
export const defaultPrefs = defaults
export const readPrefs = (): Prefs => {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return defaults()
  }
}
const apply = (p: Prefs) => {
  const d = document.documentElement.dataset
  d.motion = p.motion
  d.aurora = String(p.aurora)
  d.dense = String(p.dense)
  d.skin = p.skin
  // A fixed colour theme sets the page tint itself; "follow the card" lets each page choose (useTint).
  if (p.skin === 'card' || p.skin === 'neutral') delete d.tint
  else d.tint = p.skin
}
apply(readPrefs())
const PREFS_EVT = 'tivan-prefs'
export function usePrefs() {
  const [p, setP] = useState(readPrefs)
  useEffect(() => {
    const sync = () => setP(readPrefs())
    window.addEventListener(PREFS_EVT, sync)
    return () => window.removeEventListener(PREFS_EVT, sync)
  }, [])
  const set = (patch: Partial<Prefs>) => {
    const next = { ...readPrefs(), ...patch }
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {}
    apply(next)
    window.dispatchEvent(new Event(PREFS_EVT))
  }
  return [p, set] as const
}
export const motionOff = () => document.documentElement.dataset.motion === 'off'
const calm = () => document.documentElement.dataset.motion !== 'full'

// ---- animated background: slow colour orbs that take the page tint, a faint grid, drifting dust, light mouse parallax
export function Aurora() {
  useEffect(() => {
    let raf = 0
    const move = (e: PointerEvent) => {
      if (calm()) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const s = document.documentElement.style
        s.setProperty('--px', ((e.clientX / innerWidth) * 2 - 1).toFixed(3))
        s.setProperty('--py', ((e.clientY / innerHeight) * 2 - 1).toFixed(3))
      })
    }
    addEventListener('pointermove', move, { passive: true })
    return () => (removeEventListener('pointermove', move), cancelAnimationFrame(raf))
  }, [])
  return (
    <div className="aurora" aria-hidden>
      <div className="layer l1"><i className="orb o1" /></div>
      <div className="layer l2"><i className="orb o2" /></div>
      <div className="layer l3"><i className="orb o3" /></div>
      <i className="gridlines" />
      {Array.from({ length: 16 }, (_, n) => (
        <b key={n} className="dust" style={{ '--x': `${(n * 37) % 100}%`, '--d': `${14 + ((n * 5) % 13)}s`, '--s': `${2 + (n % 3)}px`, '--w': `${-n * 1.7}s` } as CSSProperties} />
      ))}
    </div>
  )
}

// ---- reveal: every section, row and card fades and rises in as it scrolls into view, staggered. One observer for the page.
export function useRevealAll(key: string) {
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return
          const el = e.target as HTMLElement
          el.classList.add('in')
          io.unobserve(el)
          setTimeout(() => el.classList.add('done'), 1100)
        }),
      { rootMargin: '0px 0px -5% 0px' },
    )
    const scan = () =>
      main.querySelectorAll<HTMLElement>('.section, .mrow, .panel, .stat-card, .board-row, .shelf-card, .tile, .grid-card, .fx-card:not(.stat-card):not(.tile)').forEach((el) => {
        if (el.dataset.seen) return
        el.dataset.seen = '1'
        el.style.setProperty('--i', String(Math.min(9, [...(el.parentElement?.children ?? [])].indexOf(el))))
        el.classList.add('rv')
        io.observe(el)
      })
    scan()
    const mo = new MutationObserver(scan)
    mo.observe(main, { childList: true, subtree: true })
    return () => (io.disconnect(), mo.disconnect())
  }, [key])
}

// ---- FLIP: elements with data-flip="key" glide to their new place when a list is sorted, filtered or reordered.
export function useFlip(ref: RefObject<HTMLElement | null>, deps: unknown[]) {
  const prev = useRef(new Map<string, DOMRect>())
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const next = new Map<string, DOMRect>()
    el.querySelectorAll<HTMLElement>('[data-flip]').forEach((n) => {
      const k = n.dataset.flip!
      const r = n.getBoundingClientRect()
      next.set(k, r)
      const p = prev.current.get(k)
      if (p && !motionOff() && (Math.abs(p.top - r.top) > 1 || Math.abs(p.left - r.left) > 1))
        n.animate([{ transform: `translate(${p.left - r.left}px, ${p.top - r.top}px)` }, { transform: 'none' }], { duration: 460, easing: 'cubic-bezier(.2,.9,.25,1.06)' })
    })
    prev.current = next
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

// ---- Card: one primitive, six variants. A glow follows the pointer, the card tilts a little, and it lifts on hover.
export type CardVariant = 'stat' | 'action' | 'status' | 'feature' | 'list' | 'empty'
type CardProps = { variant?: CardVariant; href?: string; onClick?: () => void; tilt?: boolean; i?: number; className?: string; children: ReactNode; label?: string; flip?: string; style?: CSSProperties }
export function Card({ variant = 'stat', href, onClick, tilt = true, i = 0, className = '', children, label, flip, style }: CardProps) {
  const move = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const s = e.currentTarget.style
    s.setProperty('--mx', `${x}px`)
    s.setProperty('--my', `${y}px`)
    if (tilt && !calm() && e.pointerType === 'mouse') {
      s.setProperty('--ry', `${((x / r.width - 0.5) * 7).toFixed(2)}deg`)
      s.setProperty('--rx', `${((0.5 - y / r.height) * 7).toFixed(2)}deg`)
    }
  }
  const leave = (e: React.PointerEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty('--rx', '0deg')
    e.currentTarget.style.setProperty('--ry', '0deg')
  }
  const props = { className: `fx-card ${variant === 'stat' ? 'stat-card' : variant === 'action' ? 'tile' : ''} v-${variant} ${className}`, style: { '--i': i, ...style } as CSSProperties, onPointerMove: move, onPointerLeave: leave, 'aria-label': label, 'data-flip': flip }
  if (href) return createElement('a', { ...props, href }, children)
  if (onClick) return createElement('button', { ...props, onClick, type: 'button' }, children)
  return createElement('div', props, children)
}

// ---- numbers and charts that move
export function CountUp({ value, format = (n: number) => Math.round(n).toLocaleString('en-US'), ms = 900 }: { value: number; format?: (n: number) => string; ms?: number }) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (motionOff()) return void setV(value)
    const t0 = performance.now()
    const a = from.current
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      const n = a + (value - a) * (1 - Math.pow(1 - p, 3))
      from.current = n
      setV(n)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return <>{format(v)}</>
}

/** Progress ring, 0 to 1; the arc animates to its value. */
export function Ring({ value, size = 76, children }: { value: number; size?: number; children?: ReactNode }) {
  const C = 2 * Math.PI * 18
  const [v, setV] = useState(0)
  useEffect(() => void requestAnimationFrame(() => setV(Math.max(0, Math.min(1, value)))), [value])
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 44 44" aria-hidden>
        <circle className="ring-bg" cx="22" cy="22" r="18" />
        <circle className="ring-fg" cx="22" cy="22" r="18" strokeDasharray={C} strokeDashoffset={C * (1 - v)} />
      </svg>
      <span className="ring-in">{children}</span>
    </span>
  )
}

/** Tiny line chart over real numbers only. */
export function Spark({ points, w = 96, h = 28 }: { points: number[]; w?: number; h?: number }) {
  if (points.length < 2) return null
  const lo = Math.min(...points)
  const hi = Math.max(...points)
  const d = points.map((p, n) => `${n ? 'L' : 'M'}${((n / (points.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((p - lo) / (hi - lo || 1)) * (h - 6)).toFixed(1)}`).join('')
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
      <path d={d} pathLength={1} />
    </svg>
  )
}


// ---- CardImage: the one place a card photograph is drawn. Fixed aspect ratio, lazy, shimmer then a soft unblur while it
// loads, and a plain neutral panel when the photo is missing or fails (never a stand-in illustration).
export function CardImage({ src, alt }: { src?: string; alt: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>(src ? 'loading' : 'failed')
  const ref = useRef<HTMLImageElement>(null)
  useEffect(() => setState(src ? 'loading' : 'failed'), [src])
  useEffect(() => {
    const i = ref.current
    if (i?.complete && i.naturalWidth) setState('loaded') // cached photos can finish before React attaches onLoad
  }, [src])
  return (
    <span className={`card-img ${state}`}>
      {src && state !== 'failed' && <img ref={ref} src={src} alt={alt} loading="lazy" decoding="async" onLoad={() => setState('loaded')} onError={() => setState('failed')} />}
      {state === 'failed' && (
        <span className="nophoto" role="img" aria-label={`${alt}, no photo yet`}>
          No photo yet
        </span>
      )}
    </span>
  )
}

// ---- colour themes (the same palettes the card pages use) and the Settings button, which needs no account
export const skins: { id: Skin; label: string; bg?: string; accent?: string }[] = [
  { id: 'card', label: 'Follow the card' },
  { id: 'neutral', label: 'Neutral', bg: '#12100e', accent: '#f6f1ec' },
  { id: 'char', label: 'Ember', bg: '#1d110b', accent: '#ff7a45' },
  { id: 'pika', label: 'Gold', bg: '#1a170a', accent: '#f5c842' },
  { id: 'lbj', label: 'Rose', bg: '#1a0e11', accent: '#f08aa3' },
  { id: 'mj', label: 'Crimson', bg: '#1b0d0c', accent: '#ff8a7a' },
  { id: 'lotus', label: 'Sage', bg: '#0e110f', accent: '#bfe0c8' },
  { id: 'blue', label: 'Ocean', bg: '#0b111d', accent: '#6aa4ff' },
  { id: 'green', label: 'Forest', bg: '#0c130e', accent: '#6fdc96' },
]
export const openSettings = () => window.dispatchEvent(new Event('tivan-settings'))
export const SettingsButton = ({ className = '' }: { className?: string }) => (
  <button className={`ghost line settings-btn ${className}`} onClick={openSettings} aria-haspopup="dialog">
    Settings
  </button>
)
