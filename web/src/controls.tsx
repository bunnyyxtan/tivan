import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { IconChevron, IconClose } from './icons'

// One place for every control: option lists, select, dual range, segmented control and the scroll-edge cue.
// Each is keyboard operable, shows the focus ring from the base styles, and uses the native picker on touch screens.

const COARSE = '(pointer: coarse)'
export const useCoarse = () =>
  useSyncExternalStore(
    (cb) => (matchMedia(COARSE).addEventListener('change', cb), () => matchMedia(COARSE).removeEventListener('change', cb)),
    () => matchMedia(COARSE).matches,
  )

// ===================================================================== option list (radio and checkbox)
/** A radio or checkbox row with a drawn mark, the count on the right, and selection shown by the mark and a heavier label. */
export function Opt({ type, name, checked, onChange, label, count }: { type: 'radio' | 'checkbox'; name?: string; checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; count?: number }) {
  return (
    <label className={`opt-row ${checked ? 'on' : ''}`}>
      <input className="sr" type={type} name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i className={`mark ${type}`} aria-hidden />
      <span>{label}</span>
      {count !== undefined && <small>{count}</small>}
    </label>
  )
}

// ===================================================================== select
type Option = { value: string; label: string }

/** A listbox select: arrows, Home, End, type-ahead, Enter, Escape. Touch screens get the native picker. */
export function Select({ value, onChange, options, label, className = '' }: { value: string; onChange: (v: string) => void; options: Option[]; label: string; className?: string }) {
  const coarse = useCoarse()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const btn = useRef<HTMLButtonElement>(null)
  const typed = useRef({ s: '', t: 0 })
  const id = useId()
  const sel = Math.max(0, options.findIndex((o) => o.value === value))
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, id])
  if (coarse)
    return (
      <select className={`nsel ${className}`} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    )
  const pick = (i: number) => {
    onChange(options[i].value)
    setOpen(false)
    btn.current?.focus()
  }
  const find = (ch: string) => {
    const now = Date.now()
    typed.current = { s: now - typed.current.t > 700 ? ch : typed.current.s + ch, t: now }
    const q = typed.current.s.toLowerCase()
    return options.findIndex((o) => o.label.toLowerCase().replace(/^sort: /, '').startsWith(q))
  }
  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key
    const cur = open ? active : sel
    if (k === 'Escape') return open ? (e.preventDefault(), e.stopPropagation(), setOpen(false)) : undefined
    if (k === 'Tab') return setOpen(false)
    if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End') {
      e.preventDefault()
      const next = k === 'Home' ? 0 : k === 'End' ? options.length - 1 : Math.max(0, Math.min(options.length - 1, cur + (k === 'ArrowDown' ? 1 : -1)))
      if (open) setActive(next)
      else if (k === 'ArrowDown' && !open && e.altKey) (setActive(sel), setOpen(true))
      else pick(next)
      return
    }
    if (k === 'Enter' || k === ' ') {
      e.preventDefault()
      return open ? pick(active) : (setActive(sel), setOpen(true))
    }
    if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const i = find(k)
      if (i >= 0) (open ? setActive(i) : pick(i))
    }
  }
  return (
    <span className={`sel ${className}`} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button
        ref={btn}
        type="button"
        className="sel-btn"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => (setActive(sel), setOpen(!open))}
        onKeyDown={onKey}
      >
        <span>{options[sel]?.label}</span>
        <IconChevron size={16} />
      </button>
      {open && (
        <ul className="sel-list" role="listbox" id={`${id}-list`} aria-label={label}>
          {options.map((o, i) => (
            <li key={o.value} id={`${id}-${i}`} role="option" aria-selected={i === sel} className={`${i === active ? 'act' : ''} ${i === sel ? 'cur' : ''}`} onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => pick(i)}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </span>
  )
}

// ===================================================================== dual range
const digits = (s: string) => Number(s.replace(/[^\d]/g, ''))

/** A numeric field that shows its value formatted and commits on Enter or blur. */
function NumField({ value, format, label, onCommit }: { value: number; format: (n: number) => string; label: string; onCommit: (n: number | undefined) => void }) {
  const [draft, setDraft] = useState<string>()
  const commit = () => {
    if (draft !== undefined) onCommit(draft.trim() === '' ? undefined : digits(draft))
    setDraft(undefined)
  }
  return (
    <input
      className="num-in"
      inputMode="numeric"
      aria-label={label}
      value={draft ?? format(value)}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (commit(), e.currentTarget.blur())}
    />
  )
}

/** Two thumbs on one track, a labelled numeric input at each end, both ends formatted the same way. */
export function RangeDual({ min, max, step, lo, hi, onChange, format, name }: { min: number; max: number; step: number; lo?: number; hi?: number; onChange: (lo: number | undefined, hi: number | undefined) => void; format: (n: number) => string; name: string }) {
  const a = Math.min(Math.max(lo ?? min, min), max)
  const b = Math.min(Math.max(hi ?? max, min), max)
  const span = Math.max(1, max - min)
  const out = (x: number, bound: number) => (x === bound ? undefined : x)
  const setLo = (n: number | undefined) => onChange(n === undefined ? undefined : out(Math.min(Math.max(n, min), b), min), hi)
  const setHi = (n: number | undefined) => onChange(lo, n === undefined ? undefined : out(Math.max(Math.min(n, max), a), max))
  return (
    <div className="rng">
      <div className="rng-nums">
        <NumField value={a} format={format} label={`Lowest ${name}`} onCommit={setLo} />
        <span aria-hidden>to</span>
        <NumField value={b} format={format} label={`Highest ${name}`} onCommit={setHi} />
      </div>
      <div className="rng-track" style={{ ['--a' as string]: `${((a - min) / span) * 100}%`, ['--b' as string]: `${((b - min) / span) * 100}%` }}>
        <i aria-hidden />
        <input type="range" aria-label={`Lowest ${name}`} aria-valuetext={format(a)} min={min} max={max} step={step} value={a} onChange={(e) => onChange(out(Math.min(+e.target.value, b), min), hi)} />
        <input type="range" aria-label={`Highest ${name}`} aria-valuetext={format(b)} min={min} max={max} step={step} value={b} onChange={(e) => onChange(lo, out(Math.max(+e.target.value, a), max))} />
      </div>
    </div>
  )
}

// ===================================================================== segmented control
/** One choice from a few, shown side by side. Arrow keys move the choice and the focus together. */
export function Seg<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; text?: string }[]; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const i = Math.max(0, options.findIndex((o) => o.value === value))
  const onKey = (e: React.KeyboardEvent) => {
    const n = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : -1
    if (n < 0) return
    e.preventDefault()
    const to = (n + options.length) % options.length
    onChange(options[to].value)
    refs.current[to]?.focus()
  }
  return (
    <span className="seg" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o, k) => (
        <button key={o.value} ref={(el) => void (refs.current[k] = el)} type="button" role="radio" aria-checked={o.value === value} aria-label={o.text} tabIndex={o.value === value ? 0 : -1} className={o.value === value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </span>
  )
}

// ===================================================================== scroll edge cue
/** Marks a scroller with data-more="start end" only while there is more to scroll in that direction. */
export function useEdgeCue<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const mark = () => {
      const more = [el.scrollLeft > 1 && 'start', el.scrollLeft + el.clientWidth < el.scrollWidth - 1 && 'end'].filter(Boolean).join(' ')
      if (el.dataset.more !== more) el.dataset.more = more
    }
    mark()
    el.addEventListener('scroll', mark, { passive: true })
    const ro = new ResizeObserver(mark)
    ro.observe(el)
    return () => (el.removeEventListener('scroll', mark), ro.disconnect())
  })
  return ref
}

// ===================================================================== button, chip, copy
type Variant = 'primary' | 'secondary' | 'tertiary' | 'danger'
const variantClass: Record<Variant, string> = { primary: 'btn', secondary: 'ghost line', tertiary: 'ghost', danger: 'btn danger' }

/** Primary (one per view), secondary, tertiary and destructive, at 32, 40 or 48px. A pending button keeps its width and label,
 *  shows a small indicator beside the label, and ignores a second press. */
export function Button({ variant = 'primary', size = 48, pending = false, onClick, children, ...rest }: { variant?: Variant; size?: 32 | 40 | 48; pending?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...rest} className={`${variantClass[variant]} ${size === 32 ? 's32' : size === 40 ? 's40' : ''} ${pending ? 'pending' : ''}`} aria-busy={pending || undefined} onClick={(e) => !pending && onClick?.(e)}>
      {pending && <span className="spin btn-spin" aria-hidden />}
      {children}
    </button>
  )
}

/** A filter chip: toggles when selected is given, removes when onRemove is given. */
export function Chip({ selected, onClick, onRemove, label, children }: { selected?: boolean; onClick?: () => void; onRemove?: () => void; label?: string; children: ReactNode }) {
  return (
    <button type="button" className="chip-b" aria-pressed={selected} aria-label={onRemove ? `Remove ${label ?? 'filter'}` : undefined} onClick={onRemove ?? onClick}>
      {children}
      {onRemove && <IconClose />}
    </button>
  )
}

/** Monospace text with a copy control, for addresses, hashes, cert numbers and block numbers. */
export function Copyable({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'done' | 'failed'>('idle')
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setState('done')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2200)
  }
  return (
    <span className="copyable">
      <span className="mono">{value}</span>
      <button type="button" className="ghost s32" aria-label={`Copy ${label}`} onClick={copy}>
        {state === 'done' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'}
      </button>
      <span className="sr" role="status">
        {state === 'done' ? `${label} copied` : state === 'failed' ? `Could not copy ${label}. Select it and copy by hand.` : ''}
      </span>
    </span>
  )
}
