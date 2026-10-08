import { useEffect, useId, useRef, useState } from 'react'
import { openCash } from './Cash'
import { useOnClose } from './controls'
import { catalog, categories } from './config'
import { openShortcuts } from './desk'
import { openSettings } from './fx'

// Ctrl or Cmd + K: grouped results (cards, sets, actions), recent searches, and the whole thing by keyboard.
type Item = { label: string; sub?: string; run: () => void }
type Group = { title: string; items: Item[] }
const RK = 'tivan.recent'
const OPEN = 'tivan-palette'
export const openPalette = () => dispatchEvent(new Event(OPEN))
const recent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RK) ?? '[]')
  } catch {
    return []
  }
}
const go = (href: string) => () => void (location.hash = href)
const enc = encodeURIComponent

function groups(q: string, signedIn: boolean): Group[] {
  const s = q.trim().toLowerCase()
  const has = (t: string) => t.toLowerCase().includes(s)
  const actions: Item[] = [
    ...(signedIn
      ? [
          { label: 'Add cash', sub: 'Deposit or get test dollars', run: openCash },
          { label: 'Sell your card', sub: 'Scan or enter a certificate', run: go('#/sell') },
          { label: 'Open Portfolio', run: go('#/collection') },
          { label: 'Open Activity', run: go('#/activity') },
          { label: 'Open Account', run: go('#/you') },
        ]
      : [{ label: 'Sign in', run: go('#/you') }]),
    { label: 'Open Browse', run: go('#/browse') },
    { label: 'Settings', run: openSettings },
    { label: 'Keyboard shortcuts', run: openShortcuts },
  ].filter((a) => !s || has(a.label))
  const out: Group[] = []
  if (!s) {
    const r = recent()
    if (r.length) out.push({ title: 'Recent searches', items: r.map((x) => ({ label: x, run: go(`#/browse?q=${enc(x)}`) })) })
  } else {
    const cards = catalog.filter((c) => has(`${c.title} ${c.set}`)).slice(0, 6)
    if (cards.length) out.push({ title: 'Cards', items: cards.map((c) => ({ label: c.title, sub: c.set, run: go(`#/browse?q=${enc(c.title)}`) })) })
    const sets = [...new Set(catalog.map((c) => c.set))].filter(has).slice(0, 4)
    if (sets.length) out.push({ title: 'Sets', items: sets.map((x) => ({ label: x, run: go(`#/browse?set=${enc(x)}`) })) })
    const cats = categories.filter(has)
    if (cats.length) out.push({ title: 'Categories', items: cats.map((c) => ({ label: c, run: go(`#/browse?cat=${enc(c)}`) })) })
  }
  if (actions.length) out.push({ title: 'Actions', items: actions })
  return out
}

export function Palette({ signedIn }: { signedIn: boolean }) {
  const dlg = useRef<HTMLDialogElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const [on, setOn] = useState(false)
  const id = useId()
  useOnClose(dlg, () => setOn(false))
  const gs = on ? groups(q, signedIn) : []
  const flat = gs.flatMap((g) => g.items)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQ('')
        setI(0)
        setOn(true)
        setTimeout(() => {
          if (dlg.current && !dlg.current.open) dlg.current.showModal()
          input.current?.focus()
        }, 0)
      }
    }
    const show = () => key(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    addEventListener('keydown', key)
    addEventListener(OPEN, show)
    return () => (removeEventListener('keydown', key), removeEventListener(OPEN, show))
  }, [])
  const run = (it: Item) => {
    if (q.trim()) {
      try {
        localStorage.setItem(RK, JSON.stringify([q.trim(), ...recent().filter((x) => x !== q.trim())].slice(0, 5)))
      } catch {}
    }
    dlg.current?.close()
    it.run()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (flat.length) setI((i + (e.key === 'ArrowDown' ? 1 : -1) + flat.length) % flat.length)
    } else if (e.key === 'Home') (e.preventDefault(), setI(0))
    else if (e.key === 'End') (e.preventDefault(), setI(Math.max(0, flat.length - 1)))
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (flat[i]) run(flat[i])
      else if (q.trim()) run({ label: q, run: go(`#/browse?q=${enc(q.trim())}`) })
    }
  }
  return (
    <dialog ref={dlg} className="palette" aria-label="Command palette" onClick={(e) => e.target === dlg.current && dlg.current?.close()}>
      {on && (
        <>
          <input
            ref={input}
            className="palette-in"
            role="combobox"
            aria-expanded
            aria-controls={id}
            aria-activedescendant={flat[i] ? `${id}-${i}` : undefined}
            aria-label="Search cards, sets and actions"
            placeholder="Search cards, sets and actions"
            value={q}
            onChange={(e) => (setQ(e.target.value), setI(0))}
            onKeyDown={onKey}
          />
          <div className="palette-list" role="listbox" id={id} aria-label="Results">
            {gs.length === 0 && <p className="fine pal-empty">Nothing matches “{q}”. Press Enter to search Browse for it.</p>}
            {gs.map((g) => (
              <div key={g.title} role="group" aria-label={g.title}>
                <div className="fine pal-h" aria-hidden>
                  {g.title}
                </div>
                {g.items.map((it) => {
                  const k = flat.indexOf(it)
                  return (
                    <div key={it.label + k} id={`${id}-${k}`} role="option" aria-selected={k === i} className={k === i ? 'on' : ''} onMouseMove={() => setI(k)} onClick={() => run(it)}>
                      {it.label}
                      {it.sub && <small>{it.sub}</small>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          <p className="fine pal-foot">Arrow keys to move, Enter to choose, Esc to close.</p>
        </>
      )}
    </dialog>
  )
}
