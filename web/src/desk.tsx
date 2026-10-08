import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { catalog, categories, net } from './config'
import { useEdgeCue } from './controls'
import { openSettings } from './fx'
import { recentFills, type FeedItem } from './chain'
import { IconClose, IconSearch } from './icons'
import { Skeleton } from './States'
import { short, usd, usePoll } from './ui'

// ===================================================================== keyboard
/** True when a key press belongs to text editing or the browser, so a shortcut must stand down. */
export const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null
  return !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || e.metaKey || e.ctrlKey || e.altKey)
}
const KEYS_EVT = 'tivan-keys'
export const openShortcuts = () => dispatchEvent(new Event(KEYS_EVT))

const shortcuts: [string, string][] = [
  ['/', 'Focus search'],
  ['Ctrl K', 'Open the command palette (Cmd K on a Mac)'],
  ['Esc', 'Close search or a dialog'],
  ['?', 'Show this list'],
  ['↑ ↓', 'Move between table rows'],
  ['Enter', 'Open the focused row'],
  ['C', 'Add or remove the focused card from Compare'],
  ['← →', 'Switch tabs, or scroll a row of cards'],
]

export function Shortcuts() {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const open = () => !ref.current?.open && ref.current?.showModal()
    const key = (e: KeyboardEvent) => {
      if (e.key === '?' && !typing(e)) (e.preventDefault(), open())
    }
    addEventListener('keydown', key)
    addEventListener(KEYS_EVT, open)
    return () => (removeEventListener('keydown', key), removeEventListener(KEYS_EVT, open))
  }, [])
  return (
    <dialog ref={ref} className="kbd-dialog" aria-labelledby="kbd-title" onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="settings-head">
        <h2 id="kbd-title">Keyboard shortcuts</h2>
        <button className="ghost line" autoFocus onClick={() => ref.current?.close()}>
          Done
        </button>
      </div>
      <dl className="kbd-list">
        {shortcuts.map(([k, d]) => (
          <div key={k}>
            <dt>
              <kbd>{k}</kbd>
            </dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
      <p className="fine">Shortcuts pause while you type in a field.</p>
    </dialog>
  )
}

// ===================================================================== search
type Sug = { label: string; sub?: string; href: string }
type Group = { title: string; items: Sug[] }
const RK = 'tivan.recent'
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RK) ?? '[]')
  } catch {
    return []
  }
}
const enc = encodeURIComponent
const hasText = (s: string, q: string) => s.toLowerCase().includes(q)

function suggest(q: string): Group[] {
  const s = q.trim().toLowerCase()
  const cats = categories.filter((c) => !s || hasText(c, s))
  const out: Group[] = []
  if (!s) {
    const r = readRecent()
    if (r.length) out.push({ title: 'Recent searches', items: r.map((x) => ({ label: x, href: `#/browse?q=${enc(x)}` })) })
  } else {
    const cards = catalog.filter((c) => hasText(`${c.title} ${c.set}`, s)).slice(0, 5)
    if (cards.length) out.push({ title: 'Cards', items: cards.map((c) => ({ label: c.title, sub: c.set, href: `#/browse?q=${enc(c.title)}` })) })
    const sets = [...new Set(catalog.map((c) => c.set))].filter((x) => hasText(x, s)).slice(0, 4)
    if (sets.length) out.push({ title: 'Sets', items: sets.map((x) => ({ label: x, href: `#/browse?set=${enc(x)}` })) })
  }
  if (cats.length) out.push({ title: 'Categories', items: cats.map((c) => ({ label: c, href: `#/browse?cat=${enc(c)}` })) })
  return out
}

/** The wide search in the top bar: grouped suggestions, "/" to focus, Esc to close. */
export function SearchBox() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [i, setI] = useState(-1)
  const input = useRef<HTMLInputElement>(null)
  const id = useId()
  const groups = open ? suggest(q) : []
  const flat = groups.flatMap((g) => g.items)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === '/' && !typing(e)) (e.preventDefault(), input.current?.focus())
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  }, [])
  const go = (href: string, label: string) => {
    const next = [label, ...readRecent().filter((x) => x !== label)].slice(0, 5)
    try {
      localStorage.setItem(RK, JSON.stringify(next))
    } catch {}
    location.hash = href
    setQ('')
    setOpen(false)
    input.current?.blur()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return (setOpen(false), setI(-1), input.current?.blur())
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      if (flat.length) setI((i + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length)
    }
    if (e.key === 'Enter') {
      const pick = flat[i]
      if (pick) go(pick.href, pick.label)
      else if (q.trim()) go(`#/browse?q=${enc(q.trim())}`, q.trim())
    }
  }
  return (
    <div className="search" data-tour="search" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <label className="field search-field">
        <IconSearch size={18} />
        <input
          ref={input}
          role="combobox"
          aria-expanded={flat.length > 0}
          aria-controls={id}
          aria-autocomplete="list"
          aria-activedescendant={i >= 0 ? `${id}-${i}` : undefined}
          aria-label="Search cards, sets and categories"
          placeholder="Search cards, sets and categories"
          value={q}
          onChange={(e) => (setQ(e.target.value), setOpen(true), setI(-1))}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        <kbd aria-hidden>/</kbd>
      </label>
      {flat.length > 0 && (
        <div className="search-pop" role="listbox" id={id} aria-label="Suggestions">
          {groups.map((g) => (
            <div key={g.title} role="group" aria-label={g.title}>
              <div className="cap" aria-hidden>
                {g.title}
              </div>
              {g.items.map((s) => {
                const k = flat.indexOf(s)
                return (
                  <div key={s.href} id={`${id}-${k}`} role="option" aria-selected={k === i} className={k === i ? 'on' : ''} onMouseDown={(e) => e.preventDefault()} onClick={() => go(s.href, s.label)}>
                    {s.label}
                    {s.sub && <small>{s.sub}</small>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===================================================================== small pieces
export const Breadcrumbs = ({ items }: { items: [string, string?][] }) => (
  <nav aria-label="Breadcrumb" className="crumbs">
    <ol>
      {items.map(([label, href], k) => (
        <li key={k} aria-current={k === items.length - 1 ? 'page' : undefined}>
          {href && k < items.length - 1 ? <a href={href}>{label}</a> : label}
        </li>
      ))}
    </ol>
  </nav>
)

/** Tabs, each with an optional count. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: [T, string, number?][]; value: T; onChange: (t: T) => void; label: string }) {
  const onKey = (e: React.KeyboardEvent) => {
    const i = tabs.findIndex((t) => t[0] === value)
    const next = e.key === 'ArrowRight' ? tabs[(i + 1) % tabs.length][0] : e.key === 'ArrowLeft' ? tabs[(i + tabs.length - 1) % tabs.length][0] : e.key === 'Home' ? tabs[0][0] : e.key === 'End' ? tabs.at(-1)![0] : undefined
    if (!next) return
    e.preventDefault()
    onChange(next)
    requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus())
  }
  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map(([k, text, count]) => (
        <button key={k} role="tab" id={`tab-${k}`} aria-selected={value === k} aria-controls={`panel-${k}`} tabIndex={value === k ? 0 : -1} onClick={() => onChange(k)}>
          {text}
          {count !== undefined && <span className="count">{count}</span>}
        </button>
      ))}
    </div>
  )
}

// ===================================================================== table
export type Col<T> = { key: string; label: string; right?: boolean; sort?: string; cell: (r: T, tab: 0 | -1) => ReactNode }

/** A real table: sticky header, sortable columns, arrow keys move the row, row actions show on hover and on focus. */
export function DataTable<T>({ cols, rows, rowKey, label, sort, onSort, onOpen, onRowKey }: { cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; label: string; sort?: string; onSort?: (key: string) => void; onOpen?: (r: T) => void; onRowKey?: (e: React.KeyboardEvent, r: T) => void }) {
  const [active, setActive] = useState(0)
  const body = useRef<HTMLTableSectionElement>(null)
  const a = Math.min(active, rows.length - 1)
  const move = (to: number) => {
    const n = Math.max(0, Math.min(rows.length - 1, to))
    setActive(n)
    body.current?.rows[n]?.focus()
  }
  const dir = sort?.startsWith('-') ? 'descending' : 'ascending'
  return (
    <table className="dtable" aria-label={label}>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c.key} scope="col" className={c.right ? 'num' : ''} aria-sort={c.sort && sort?.replace('-', '') === c.sort ? dir : undefined}>
              {c.sort && onSort ? (
                <button onClick={() => onSort(c.sort!)}>
                  {c.label}
                  <span aria-hidden>{sort?.replace('-', '') === c.sort ? (dir === 'ascending' ? ' ↑' : ' ↓') : ''}</span>
                </button>
              ) : (
                c.label
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody ref={body}>
        {rows.map((r, i) => (
          <tr
            key={rowKey(r)}
            tabIndex={i === a ? 0 : -1}
            onFocus={(e) => e.target === e.currentTarget && setActive(i)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return
              const k = e.key
              if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End') (e.preventDefault(), move(k === 'ArrowDown' ? i + 1 : k === 'ArrowUp' ? i - 1 : k === 'Home' ? 0 : rows.length - 1))
              else if (k === 'Enter') onOpen?.(r)
              else onRowKey?.(e, r)
            }}
          >
            {cols.map((c) => (
              <td key={c.key} className={c.right ? 'num' : ''}>
                {c.cell(r, i === a ? 0 : -1)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** Loading rows with the table's own column geometry. */
export const TableSkeleton = ({ cols, rows = 8 }: { cols: { key: string; label: string; right?: boolean }[]; rows?: number }) => (
  <table className="dtable" aria-hidden>
    <thead>
      <tr>
        {cols.map((c) => (
          <th key={c.key} className={c.right ? 'num' : ''}>
            {c.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: rows }, (_, i) => (
        <tr key={i}>
          {cols.map((c, k) => (
            <td key={c.key} className={c.right ? 'num' : ''}>
              <Skeleton h={k === 0 ? 40 : 14} w={k === 0 ? '70%' : 56} r={6} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
)

// ===================================================================== chart
function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(340)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** A plain step chart sized to its box: each value holds until the next point; the final point is labelled. */
export function Chart({ pts, h = 150, tag = 'Last sale', label }: { pts: { t: number; price: number }[]; h?: number; tag?: string; label: string }) {
  const [ref, W] = useWidth()
  const gid = useId()
  const L = 54
  const B = 22
  const ps = pts.map((p) => p.price)
  const pad = Math.max(1, (Math.max(...ps) - Math.min(...ps)) * 0.2)
  const lo = Math.max(0, Math.min(...ps) - pad)
  const hi = Math.max(...ps) + pad
  const t0 = pts[0].t
  const span = Math.max(60, pts.at(-1)!.t - t0)
  const x = (t: number) => L + ((t - t0) / span) * (W - L - 12)
  const y = (p: number) => 8 + (1 - (p - lo) / (hi - lo)) * (h - B - 12)
  const d = pts.map((p, i) => (i ? `H${x(p.t).toFixed(1)}V${y(p.price).toFixed(1)}` : `M${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`)).join('')
  const last = pts.at(-1)!
  const day = (t: number) => new Date(t * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: span > 300 * 86400 ? 'numeric' : undefined })
  const left = x(last.t) > W - 130
  return (
    <div className="hist" ref={ref}>
      <svg viewBox={`0 0 ${W} ${h}`} style={{ height: h }} role="img" aria-label={label}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--chart-fill-top)' }} />
            <stop offset="1" style={{ stopColor: 'var(--chart-fill-bottom)' }} />
          </linearGradient>
        </defs>
        {[hi, (hi + lo) / 2, lo].map((v, i) => (
          <g key={i}>
            <line className="grid" x1={L} x2={W - 8} y1={y(v)} y2={y(v)} />
            <text className="axis" x={L - 8} y={y(v) + 3} textAnchor="end">
              {usd(Math.round(v))}
            </text>
          </g>
        ))}
        <text className="axis" x={L} y={h - 6}>
          {day(t0)}
        </text>
        <text className="axis" x={W - 8} y={h - 6} textAnchor="end">
          {day(last.t)}
        </text>
        <path className="area" d={`${d}V${y(lo)}H${x(t0)}Z`} fill={`url(#${gid})`} />
        <path className="line" d={d} />
        <circle className="last" cx={x(last.t)} cy={y(last.price)} r="4" />
        <text className="tag" x={x(last.t) + (left ? -10 : 10)} y={Math.max(y(last.price) - 9, 12)} textAnchor={left ? 'end' : 'start'}>
          {tag} {usd(last.price)}
        </text>
      </svg>
    </div>
  )
}

// ===================================================================== sales and compare
export const ago = (t: number) => {
  const s = Math.max(0, Date.now() / 1000 - t)
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`
}

export type Change = { last: number; prev: number; pct: number }
/** The latest sales across every card (needs the indexer) and each card's move from its previous sale to its last. */
export function useSales() {
  const { data, error } = usePoll(() => recentFills(300), 30000, [])
  const change = useMemo(() => {
    const m = new Map<string, Change>()
    const seen = new Map<string, number>()
    for (const f of data ?? []) {
      const k = f.sku.toLowerCase()
      const last = seen.get(k)
      if (last === undefined) seen.set(k, f.price)
      else if (!m.has(k)) m.set(k, { last, prev: f.price, pct: last / f.price - 1 })
    }
    return m
  }, [data])
  return { fills: data as FeedItem[] | undefined, change, error }
}

const CK = 'tivan.compare'
const CEVT = 'tivan-compare'
const readIds = (raw: string): string[] => {
  try {
    return JSON.parse(raw || '[]')
  } catch {
    return []
  }
}
/** Up to four cards picked for Compare, kept for this tab. */
export function useCompare() {
  const raw = useSyncExternalStore(
    (cb) => (addEventListener(CEVT, cb), () => removeEventListener(CEVT, cb)),
    () => sessionStorage.getItem(CK) ?? '',
  )
  const ids = readIds(raw)
  const save = (next: string[]) => {
    try {
      sessionStorage.setItem(CK, JSON.stringify(next))
    } catch {}
    dispatchEvent(new Event(CEVT))
  }
  return { ids, full: ids.length >= 4, has: (s: string) => ids.includes(s), toggle: (s: string) => save(ids.includes(s) ? ids.filter((x) => x !== s) : ids.length < 4 ? [...ids, s] : ids), clear: () => save([]) }
}

export function CompareTray({ names }: { names: (sku: string) => string | undefined }) {
  const c = useCompare()
  const cue = useEdgeCue<HTMLUListElement>()
  if (!c.ids.length) return null
  return (
    <aside className="tray" aria-label="Compare tray">
      <span className="cap">Compare</span>
      <ul ref={cue}>
        {c.ids.map((id) => (
          <li key={id}>
            {names(id) ?? 'Card'}
            <button aria-label={`Remove ${names(id) ?? 'card'} from Compare`} onClick={() => c.toggle(id)}>
              <IconClose size={14} />
            </button>
          </li>
        ))}
      </ul>
      <span className="fine">{c.ids.length} of 4</span>
      <button className="ghost" onClick={c.clear}>
        Clear
      </button>
      {c.ids.length > 1 ? (
        <a className="btn" href={`#/compare?ids=${c.ids.join(',')}`}>
          Compare {c.ids.length} cards
        </a>
      ) : (
        <span className="fine">Add one more to compare</span>
      )}
    </aside>
  )
}

// ===================================================================== account menu and the sample-market notice
/** The signed-in account button: the user's initial, opening Account, Settings, Help and shortcuts, Sign out. */
export function AccountMenu({ address, onSignOut, initial = 'C' }: { address: string; onSignOut: () => void; initial?: string }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus()
  }, [open])
  const close = (refocus = true) => (setOpen(false), refocus && btn.current?.focus())
  const key = (e: React.KeyboardEvent) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'Escape') return (e.preventDefault(), close())
    if (e.key === 'Tab') return close(false)
    const to = e.key === 'ArrowDown' ? (i + 1) % items.length : e.key === 'ArrowUp' ? (i - 1 + items.length) % items.length : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1
    if (to >= 0) (e.preventDefault(), items[to].focus())
  }
  return (
    <div className="acct-menu" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <button ref={btn} className="acct-btn" data-tour="account" aria-label="Account menu" title={short(address)} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {initial}
      </button>
      {open && (
        <div className="menu" role="menu" aria-label="Account" ref={list} onKeyDown={key}>
          <a role="menuitem" href="#/you" onClick={() => close(false)}>
            Account
          </a>
          <button role="menuitem" onClick={() => (close(false), openSettings())}>
            Settings
          </button>
          <button role="menuitem" onClick={() => (close(false), openShortcuts())}>
            Help and shortcuts
          </button>
          <hr />
          <button role="menuitem" onClick={() => (close(false), onSignOut())}>
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

/** The one place the app says it is a sample: a slim strip, and a dialog listing what is simulated and what is real. */
export function DemoStrip() {
  const ref = useRef<HTMLDialogElement>(null)
  if (net.name !== 'testnet') return null
  return (
    <>
      <div className="strip">
        <b><i aria-hidden />Test network</b>
        <span>Prices come from an automated market maker. Cash and custody are simulated.</span>
        <button className="linkbtn" onClick={() => ref.current?.showModal()}>
          What is real
        </button>
      </div>
      <dialog ref={ref} className="strip-dialog" aria-labelledby="demo-title" onClick={(e) => e.target === ref.current && ref.current?.close()}>
        <div className="settings-head">
          <h2 id="demo-title">About this sample market</h2>
          <button className="ghost line" autoFocus onClick={() => ref.current?.close()}>
            Done
          </button>
        </div>
        <h3>Simulated</h3>
        <ul>
          <li>Prices. A market-making bot quotes most cards at reference prices with a spread of its own. Collectors can post prices too.</li>
          <li>Cash. Dollars are free test dollars and have no value.</li>
          <li>Custody. The vault check-in is simulated: a demo custodian confirms receipt at once.</li>
          <li>Grading checks. On the test network, certificates are checked against a demo registry.</li>
          <li>Card pictures. They show the card, not a photograph of the slab.</li>
        </ul>
        <h3>Real</h3>
        <ul>
          <li>Orders and trades. Offers, asks and sales run as transactions on a public test network, on on-chain order books.</li>
          <li>Sign-in. Your account key comes from a passkey on your device. In test mode it is a key stored in this browser.</li>
          <li>Money. Nothing here costs or pays real money.</li>
        </ul>
      </dialog>
    </>
  )
}
