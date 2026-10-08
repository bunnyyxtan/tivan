import { useEffect, useRef, useState } from 'react'
import { Button } from './controls'

// A short spotlight tour: five steps at most, skippable at every step, fully keyboard operable, and never started on its own.
// The spotlight is four flat scrims around the target, with the target itself left clear: no glow, no blur.
const EVT = 'tivan-tour'
export const startTour = () => dispatchEvent(new Event(EVT))

type Step = { target: string; title: string; text: string }
const STEPS: Step[] = [
  { target: 'search', title: 'Search', text: 'Find a card, a set or an action. Press / to jump here, or Ctrl K for the command palette.' },
  { target: 'browse', title: 'Browse', text: 'Every market with filters, a table view for comparing, and a compare tray.' },
  { target: 'cash', title: 'Your cash', text: 'Add cash, see what is available and what an open offer reserves.' },
  { target: 'signin', title: 'Sign in', text: 'Sign in with a passkey to trade. Browsing never needs it.' },
  { target: 'sell', title: 'Sell your card', text: 'Scan the label or type its certificate number, check the slab into the vault, then price it.' },
  { target: 'account', title: 'Your account', text: 'Account, settings, help and shortcuts, and sign out are in this menu.' },
]

export function Tour() {
  const [i, setI] = useState<number>()
  const [steps, setSteps] = useState<{ step: Step; el: HTMLElement }[]>([])
  const [, tick] = useState(0)
  const card = useRef<HTMLDivElement>(null)
  const from = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const start = () => {
      location.hash = '#/'
      setTimeout(() => {
        const found = STEPS.map((step) => ({ step, el: document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`) })).filter((x): x is { step: Step; el: HTMLElement } => !!x.el && x.el.offsetParent !== null).slice(0, 5)
        if (!found.length) return
        from.current = document.activeElement as HTMLElement
        setSteps(found)
        setI(0)
      }, 300)
    }
    addEventListener(EVT, start)
    return () => removeEventListener(EVT, start)
  }, [])
  const end = () => {
    setI(undefined)
    from.current?.focus()
  }
  useEffect(() => {
    if (i === undefined) return
    steps[i]?.el.scrollIntoView({ block: 'center' })
    card.current?.querySelector<HTMLElement>('button')?.focus()
    const move = () => tick((n) => n + 1)
    addEventListener('resize', move)
    addEventListener('scroll', move, true)
    return () => (removeEventListener('resize', move), removeEventListener('scroll', move, true))
  }, [i, steps])
  if (i === undefined || !steps[i]) return null
  const { step, el } = steps[i]
  const r = el.getBoundingClientRect()
  const pad = 6
  const box = { l: Math.max(0, r.left - pad), t: Math.max(0, r.top - pad), r: Math.min(innerWidth, r.right + pad), b: Math.min(innerHeight, r.bottom + pad) }
  const below = box.b + 190 < innerHeight
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') return end()
    if (e.key === 'ArrowRight') return i < steps.length - 1 ? setI(i + 1) : end()
    if (e.key === 'ArrowLeft' && i > 0) setI(i - 1)
    if (e.key === 'Tab') {
      const b = [...(card.current?.querySelectorAll<HTMLElement>('button') ?? [])]
      if (!b.length) return
      const first = b[0]
      const last = b[b.length - 1]
      if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus())
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus())
    }
  }
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-label="Tour" onKeyDown={key}>
      <i className="scrim" style={{ left: 0, top: 0, right: 0, height: box.t }} />
      <i className="scrim" style={{ left: 0, top: box.b, right: 0, bottom: 0 }} />
      <i className="scrim" style={{ left: 0, top: box.t, width: box.l, height: box.b - box.t }} />
      <i className="scrim" style={{ left: box.r, top: box.t, right: 0, height: box.b - box.t }} />
      <i className="tour-ring" style={{ left: box.l, top: box.t, width: box.r - box.l, height: box.b - box.t }} />
      <div ref={card} className="tour-card" style={{ left: Math.min(Math.max(12, box.l), innerWidth - 332), top: below ? box.b + 12 : Math.max(12, box.t - 172) }}>
        <p className="fine">Step {i + 1} of {steps.length}</p>
        <h2>{step.title}</h2>
        <p>{step.text}</p>
        <div className="tx-actions">
          <Button size={32} onClick={() => (i < steps.length - 1 ? setI(i + 1) : end())}>{i < steps.length - 1 ? 'Next' : 'Done'}</Button>
          {i > 0 && <Button variant="secondary" size={32} onClick={() => setI(i - 1)}>Back</Button>}
          <Button variant="tertiary" size={32} onClick={end}>Skip the tour</Button>
        </div>
      </div>
    </div>
  )
}
