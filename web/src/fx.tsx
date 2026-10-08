import { useEffect, useRef, useState } from 'react'
import { IconSettings } from './icons'

// ---- preferences: saved in this browser, applied as <html> attributes
export type Theme = 'system' | 'light' | 'dark'
export type Prefs = { motion: 'full' | 'off'; dense: boolean; view: 'list' | 'grid'; theme: Theme; haptics: boolean }
const KEY = 'tivan.prefs'
const defaults = (): Prefs => ({ motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'full', dense: false, view: 'grid', theme: 'dark', haptics: false })
export const defaultPrefs = defaults

export const readPrefs = (): Prefs => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    const d = defaults()
    return {
      motion: s.motion === 'off' ? 'off' : s.motion ? 'full' : d.motion,
      dense: typeof s.dense === 'boolean' ? s.dense : d.dense,
      view: s.view === 'list' ? 'list' : s.view === 'grid' ? 'grid' : d.view,
      theme: s.theme === 'light' || s.theme === 'system' ? s.theme : 'dark',
      haptics: s.haptics === true,
    }
  } catch {
    return defaults()
  }
}
const LIGHT = '(prefers-color-scheme: light)'
const THEME_COLOR = { light: '#f7f6f2', dark: '#0a0a0b' }
const apply = (p: Prefs) => {
  const root = document.documentElement
  const d = root.dataset
  d.motion = p.motion
  d.dense = String(p.dense)
  // The mode in force: the chosen one, or the device's. The same logic runs in index.html before first paint.
  const mode = p.theme === 'system' ? (matchMedia(LIGHT).matches ? 'light' : 'dark') : p.theme
  d.theme = mode
  d.appearance = p.theme
  root.style.colorScheme = mode
  document.querySelector<HTMLMetaElement>('meta[name=theme-color]')?.setAttribute('content', THEME_COLOR[mode])
}
apply(readPrefs())
// With System chosen, follow the device live.
matchMedia(LIGHT).addEventListener('change', () => apply(readPrefs()))
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

// ---- Settings entry point, needs no account
export const openSettings = () => window.dispatchEvent(new Event('tivan-settings'))
export const SettingsButton = ({ className = '', compact = false }: { className?: string; compact?: boolean }) => (
  <button className={`${compact ? 'icon-btn' : 'ghost line settings-btn'} ${className}`} onClick={openSettings} aria-haspopup="dialog" aria-label={compact ? 'Settings' : undefined}>
    <IconSettings />
    {!compact && 'Settings'}
  </button>
)

// ---- CardImage: the one place a card photograph is drawn. Fixed aspect ratio, lazy, a plain frame while it loads, and a neutral
// frame carrying the card's name when the photo is missing or fails. Never a stand-in illustration.
export function CardImage({ src, alt, label }: { src?: string; alt: string; label?: string }) {
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
          {label && <b>{label}</b>}
          <small>No photo yet</small>
        </span>
      )}
    </span>
  )
}

/** A short buzz when an on-chain action finishes, only on phones that can, and only if the person turned it on. */
export const canBuzz = () => typeof navigator !== 'undefined' && 'vibrate' in navigator
export const buzz = () => {
  if (canBuzz() && readPrefs().haptics) navigator.vibrate(12)
}
