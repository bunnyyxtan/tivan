import { useState } from 'react'
import { catalogOf } from './config'
import type { Sku } from './chain'
import { CardImage } from './fx'
import { Slab, cardSub, cardTitle, parseName } from './ui'
import { cents, usdC } from './cardParts'

export const gradeOf = (s: Sku) => Number(parseName(s.name).grade)

export const askText = (s: Sku, live: boolean) => (!live ? 'Opening soon' : s.ask ? usdC(cents(s.ask)) : 'No sellers')
export const offerText = (s: Sku, live: boolean) => (!live ? '—' : s.bid ? usdC(cents(s.bid)) : 'No offers')
export const lastText = (s: Sku) => (s.last ? usdC(cents(s.last)) : '—')

/** Front and slab views of one card. Zoom follows the pointer, or the arrow keys once switched on with Z or the button. */
export function Viewer({ s, onInspect }: { s: { name: string; sku: string }; onInspect?: () => void }) {
  const [view, setView] = useState<'front' | 'slab'>('front')
  const [zoom, setZoom] = useState(false)
  const [at, setAt] = useState({ x: 50, y: 50 })
  const c = catalogOf(s.name)
  const name = cardTitle(s.name)
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!zoom) return
    const r = e.currentTarget.getBoundingClientRect()
    setAt({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
  }
  const key = (e: React.KeyboardEvent) => {
    const k = e.key
    if (k === 'z' || k === 'Z' || k === 'Enter') return (e.preventDefault(), setZoom(!zoom))
    if (!zoom || !k.startsWith('Arrow')) return
    e.preventDefault()
    setAt((p) => ({ x: Math.max(0, Math.min(100, p.x + (k === 'ArrowRight' ? 12 : k === 'ArrowLeft' ? -12 : 0))), y: Math.max(0, Math.min(100, p.y + (k === 'ArrowDown' ? 12 : k === 'ArrowUp' ? -12 : 0))) }))
  }
  return (
    <div className="viewer">
      <div className="thumbs" role="group" aria-label="Views">
        <button className={view === 'front' ? 'on' : ''} aria-pressed={view === 'front'} aria-label="Front of the card" onClick={() => setView('front')}>
          <CardImage src={c?.imageUrl} alt="" label={name} />
          <span>Front</span>
        </button>
        <button className={view === 'slab' ? 'on' : ''} aria-pressed={view === 'slab'} aria-label="Graded slab" onClick={() => (setView('slab'), setZoom(false))}>
          <Slab name={s.name} size="xs" />
          <span>Slab</span>
        </button>
        <button className={`mini ${zoom ? 'on' : ''}`} aria-pressed={zoom} disabled={view !== 'front'} onClick={() => setZoom(!zoom)}>
          Zoom
        </button>
        {onInspect && (
          <button className="mini" onClick={onInspect}>
            Inspect
          </button>
        )}
      </div>
      <div className="stage">
        {view === 'slab' ? (
          <Slab name={s.name} size="xl" vt={`card-${s.sku}`} />
        ) : (
          <div className={`zoomer ${zoom ? 'on' : ''}`} tabIndex={0} role="group" aria-label={`${name}, front. Press Z to zoom, then use the arrow keys to move`} onPointerMove={move} onKeyDown={key} onClick={() => setZoom(!zoom)}>
            <div style={zoom ? { transformOrigin: `${at.x}% ${at.y}%`, transform: 'scale(2.4)' } : undefined}>
              <CardImage src={c?.imageUrl} alt={`${name}, ${cardSub(s.name)}`} label={name} />
            </div>
          </div>
        )}
        {c?.imageKind === 'reference' && <p className="source viewer-note">Reference image of this card, not a photograph of this slab.</p>}
      </div>
    </div>
  )
}
