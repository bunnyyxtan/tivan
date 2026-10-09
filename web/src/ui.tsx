import { CardImage, SettingsButton } from './fx'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { explorerTx } from './chain'
import { friendlyError } from './account'
import { catalogOf } from './config'
import { money, signed } from './format'

export const usd = money
/** Signed dollar difference: "+$200", "−$800". */
export const delta = signed

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
export const cardTitle = (name: string) => {
  const t = parseName(name).title
  const set = catalogOf(name)?.set.split(' · ')[0]
  return set && t.startsWith(set + ' ') ? t.slice(set.length + 1) : t
}
export const cardSub = (name: string) => {
  const { grader, grade } = parseName(name)
  const c = catalogOf(name)
  return [grader + (grade ? ` ${grade}` : ''), c?.set.replace(' · ', ' ')].filter(Boolean).join(' · ')
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
  // The private vault can replace the list from another device; every watcher re-reads on this event.
  useEffect(() => {
    const sync = () => setList(read())
    addEventListener('tivan-watch', sync)
    return () => removeEventListener('tivan-watch', sync)
  }, [])
  const toggle = (sku: string) => {
    const next = list.includes(sku) ? list.filter((x) => x !== sku) : [...list, sku]
    setList(next)
    try {
      localStorage.setItem('slab.watch', JSON.stringify(next))
    } catch {}
    dispatchEvent(new Event('tivan-watch'))
    return next.includes(sku)
  }
  return { list, toggle }
}

/** A graded slab: acrylic case, grader label, the card photo (or an honest placeholder). Tilts under the pointer. */
export function Slab({ name, size = 'md', vt, alt }: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; vt?: string; alt?: string }) {
  const { grader, grade, title } = parseName(name)
  const c = catalogOf(name)
  const [setName, year] = c?.set.split(' · ') ?? []
  // The label never truncates: the long form carries the set, the short form drops it. CSS picks one by the slab's width.
  const full = `${grader} · ${setName ? `${year} ${setName}` : title}`.toUpperCase()
  const short = `${grader} · ${year ?? title}`.toUpperCase()
  const labelBucket = full.length <= 14 ? 1 : full.length <= 20 ? 2 : full.length <= 27 ? 3 : 4
  return (
    <div className="slab-wrap" style={vt ? ({ viewTransitionName: vt } as React.CSSProperties) : undefined}>
      <div className={`slab slab-${size}`}>
        {size !== 'xs' && size !== 'sm' && (
          <div className="slab-label" data-b={labelBucket}>
            <span>
              <span className="full">{full}</span>
              <span className="short">{short}</span>
            </span>
            <b>{grade}</b>
          </div>
        )}
        {size === 'xs' || size === 'sm' ? <i className="slab-strip" /> : null}
        <CardImage src={c?.imageUrl} alt={alt ?? `${cardTitle(name)}, ${grader} ${grade}`.trim()} label={cardTitle(name)} />
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
          <span className="step-state">{{ todo: '', doing: 'Now', done: 'Done', error: 'Failed' }[s.state]}</span>
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
    <div className="topbar-right">
      {right}
      {!back && <SettingsButton compact className="mobile-only" />}
    </div>
  </header>
)

/** A short confirmation at the bottom of the screen, with an optional action (Undo). */

/** A price that rolls to its new value when it changes. It shows the first value as is: no count-up on load. */

