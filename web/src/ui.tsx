import { CardImage } from './fx'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { explorerTx } from './chain'
import { friendlyError } from './account'
import { catalogOf } from './config'

export const usd = (n: number | undefined, digits = 0) =>
  n === undefined ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Signed dollar difference: "+$200", "−$800". */
export const delta = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${usd(Math.abs(n))}`

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** "PSA 10 Base Set Charizard Holo" -> { grader: 'PSA', grade: '10', title: 'Base Set Charizard Holo' }.
 * A leading "DEMO " (mainnet placeholder SKUs with no physical card) sets demo. */
export function parseName(name: string) {
  const demo = name.startsWith('DEMO ')
  const rest = demo ? name.slice(5) : name
  const m = /^(PSA|BGS|CGC|SGC)\s+(\d{1,2}(?:\.5)?)\s+(.*)$/.exec(rest)
  return m ? { grader: m[1], grade: m[2], title: m[3], demo } : { grader: 'Graded', grade: '', title: rest, demo }
}

/** Card title without the set prefix the list already shows underneath. */
export const cardTitle = (name: string) => parseName(name).title.replace(/^(Base Set|Topps Chrome|Fleer|Alpha)\s+/, '')
export const cardSub = (name: string) => {
  const { grader, grade } = parseName(name)
  const c = catalogOf(name)
  return [grader + (grade ? ` ${grade}` : ''), c?.set.replace(' · ', ' ')].filter(Boolean).join(' · ')
}

/** The page takes its colour from the card on it (solid tones, see index.css [data-tint]). */
export function useTint(name: string | undefined) {
  useEffect(() => {
    const t = name ? catalogOf(name)?.tint : undefined
    if (t) document.documentElement.dataset.tint = t
    return () => void delete document.documentElement.dataset.tint
  }, [name])
}

export type Theme = 'auto' | 'light' | 'dark'
export const getTheme = (): Theme => {
  try {
    return (localStorage.getItem('slab.theme') as Theme) || 'auto'
  } catch {
    return 'auto'
  }
}
export function setTheme(t: Theme) {
  try {
    localStorage.setItem('slab.theme', t)
  } catch {}
  if (t === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}

/** Cards you watch live in this browser only. */
export function useWatch() {
  const read = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem('slab.watch') ?? '[]')
    } catch {
      return []
    }
  }
  const [list, setList] = useState(read)
  const toggle = (sku: string) => {
    const next = list.includes(sku) ? list.filter((x) => x !== sku) : [...list, sku]
    setList(next)
    try {
      localStorage.setItem('slab.watch', JSON.stringify(next))
    } catch {}
    return next.includes(sku)
  }
  return { list, toggle }
}

/** A graded slab: acrylic case, grader label, the card photo (or an honest placeholder). Tilts under the pointer. */
export function Slab({ name, size = 'md', tilt = false, vt }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; tilt?: boolean; vt?: string }) {
  const { grader, grade, title } = parseName(name)
  const c = catalogOf(name)
  const src = c?.imageUrl
  const [setName, year] = c?.set.split(' · ') ?? []
  const [tf, setTf] = useState('')
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!tilt || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    setTf(`perspective(900px) rotateX(${(-y * 10).toFixed(2)}deg) rotateY(${(x * 12).toFixed(2)}deg)`)
  }
  return (
    <div className={`slab-wrap ${tilt ? 'tilt' : ''}`} style={vt ? ({ viewTransitionName: vt } as React.CSSProperties) : undefined} onPointerMove={move} onPointerLeave={() => setTf('')}>
      <div className={`slab slab-${size}`} style={tf ? { transform: tf } : undefined}>
        {size !== 'xs' && size !== 'sm' && (
          <div className="slab-label">
            <span>
              {grader} · {(setName ? `${year} ${setName}` : title).toUpperCase()}
            </span>
            <b>{grade}</b>
          </div>
        )}
        {size === 'xs' || size === 'sm' ? <i className="slab-strip" /> : null}
        <CardImage src={src} alt={`${cardTitle(name)}, ${grader} ${grade}`.trim()} />
      </div>
    </div>
  )
}

export type Step = { label: string; state: 'todo' | 'doing' | 'done' | 'error'; hash?: string }

/** Runs labelled steps in order and exposes their progress for <Steps>. */
export function useFlow() {
  const [steps, setSteps] = useState<Step[]>([])
  const [error, setError] = useState<string>()
  const [raw, setRaw] = useState<unknown>()
  const busy = steps.some((s) => s.state === 'doing')
  const run = useCallback(async (list: [string, () => Promise<string | void>][]) => {
    setError(undefined)
    setRaw(undefined)
    const st: Step[] = list.map(([label]) => ({ label, state: 'todo' }))
    setSteps([...st])
    for (let i = 0; i < list.length; i++) {
      st[i] = { ...st[i], state: 'doing' }
      setSteps([...st])
      try {
        const hash = await list[i][1]()
        st[i] = { ...st[i], state: 'done', hash: hash || undefined }
      } catch (e) {
        console.error(e)
        st[i] = { ...st[i], state: 'error' }
        setSteps([...st])
        setError(friendlyError(e))
        setRaw(e)
        return false
      }
      setSteps([...st])
    }
    return true
  }, [])
  const doing = steps.find((s) => s.state === 'doing')?.label
  return { steps, error, raw, busy, doing, run, reset: () => (setSteps([]), setError(undefined)) }
}

export function Steps({ steps, error }: { steps: Step[]; error?: string }) {
  if (!steps.length) return null
  return (
    <ol className="steps" aria-live="polite">
      {steps.map((s, i) => (
        <li key={i} className={`step step-${s.state}`}>
          <span className="step-dot" aria-hidden />
          <span className="step-label">{s.label}</span>
          {s.hash && (
            <a className="u step-link" href={explorerTx(s.hash)} target="_blank" rel="noreferrer">
              record
            </a>
          )}
        </li>
      ))}
      {error && (
        <li className="error" role="alert">
          {error}
        </li>
      )}
    </ol>
  )
}

export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[]) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState<string>()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    const go = () =>
      fn().then(
        (d) => live && (setData(d), setError(undefined)),
        (e) => live && (console.error(e), setError(friendlyError(e))),
      )
    go()
    const id = setInterval(go, ms)
    return () => {
      live = false
      clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, error, refresh: () => setTick((t) => t + 1) }
}

/** Page header: a back link or the page title, plus an optional right slot. */
export const Header = ({ title, back, backLabel, right }: { title?: ReactNode; back?: string; backLabel?: string; right?: ReactNode }) => (
  <header className="topbar">
    {back ? (
      <a className="ghost back" href={back}>
        ‹ {backLabel ?? 'Back'}
      </a>
    ) : (
      <h1 className="page-title">{title}</h1>
    )}
    {back && title ? <span className="topbar-title">{title}</span> : null}
    <div className="topbar-right">{right}</div>
  </header>
)

/** A short confirmation at the bottom of the screen, with an optional action (Undo). */
export function Toast({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="toast" role="status">
      <span>{text}</span>
      {action && (
        <button className="toast-act" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}

/** A price that rolls to its new value when it changes. It shows the first value as is: no count-up on load. */
export function Roll({ value, digits = 0 }: { value: number | undefined; digits?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const a = from.current
    if (value === undefined || a === undefined || a === value || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      from.current = value
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 450)
      const e = 1 - Math.pow(1 - k, 3) // ease-out: fast start, soft landing
      const v = a + (value - a) * e
      setShown(k < 1 ? v : value)
      if (k < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{usd(shown, digits)}</>
}
