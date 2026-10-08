import type { TxKind } from './tx'

// The moment an action settles: a short confetti burst and, the first time, a badge. Motion respects the device and the
// app's Reduce motion setting; the badge and the words carry the meaning on their own.

export const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off'

/** A one-second burst of paper from the centre of the screen, drawn on a canvas that removes itself. */
export function confetti() {
  if (still()) return
  const c = document.createElement('canvas')
  const dpr = Math.min(devicePixelRatio || 1, 2)
  c.width = innerWidth * dpr
  c.height = innerHeight * dpr
  c.className = 'confetti'
  c.setAttribute('aria-hidden', 'true')
  document.body.appendChild(c)
  const g = c.getContext('2d')!
  g.scale(dpr, dpr)
  const colours = ['#daf1de', '#8eb69b', '#3fe59b', '#e6c27a', '#ffffff', '#235347']
  const ox = innerWidth / 2
  const oy = innerHeight * 0.42
  const parts = Array.from({ length: 140 }, () => {
    const a = Math.random() * Math.PI * 2
    const v = 6 + Math.random() * 9
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 6, w: 5 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colours[(Math.random() * colours.length) | 0] }
  })
  const t0 = performance.now()
  const frame = (t: number) => {
    const k = (t - t0) / 1600
    g.clearRect(0, 0, innerWidth, innerHeight)
    for (const p of parts) {
      p.vy += 0.32
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.r += p.vr
      g.save()
      g.globalAlpha = Math.max(0, 1 - k)
      g.translate(p.x, p.y)
      g.rotate(p.r)
      g.fillStyle = p.c
      g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)))
      g.restore()
    }
    if (k < 1) requestAnimationFrame(frame)
    else c.remove()
  }
  requestAnimationFrame(frame)
  setTimeout(() => c.remove(), 2500) // in case frames stop (a hidden tab)
}

export type Badge = { id: string; title: string; text: string }
const KEY = 'tivan.badges'
const FIRSTS: Partial<Record<TxKind, Badge>> = {
  buy: { id: 'first-buy', title: 'First card', text: 'You bought your first graded card on Tivan.' },
  offer: { id: 'first-offer', title: 'Bidder', text: 'Your first offer is on the book.' },
  sell: { id: 'first-sell', title: 'First sale', text: 'You sold a card at the best offer.' },
  list: { id: 'first-list', title: 'Market maker', text: 'Your first ask is on the book.' },
  deposit: { id: 'first-cash', title: 'Funded', text: 'Cash is in your account and ready to trade.' },
  withdraw: { id: 'first-out', title: 'Self-custody', text: 'You moved cash to a wallet of your own.' },
  cancel: { id: 'first-cancel', title: 'Change of plan', text: 'You cancelled an order. Reserved cash is back.' },
}
const read = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
/** Badges this action earns for the first time. Earned once per browser. */
export function earn(kind: TxKind, seconds?: number): Badge[] {
  const have = read()
  const out: Badge[] = []
  const first = FIRSTS[kind]
  if (first && !have.includes(first.id)) out.push(first)
  if (seconds !== undefined && seconds < 1 && !have.includes('sub-second')) out.push({ id: 'sub-second', title: 'Sub-second', text: `Settled on Monad in ${seconds.toFixed(1)} s.` })
  if (out.length)
    try {
      localStorage.setItem(KEY, JSON.stringify([...have, ...out.map((b) => b.id)]))
    } catch {}
  return out
}
export const badgesEarned = () => read()
