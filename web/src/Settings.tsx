import { useEffect, useRef, useState } from 'react'
import { askPermission, canNotify, notifyState } from './alerts'
import { defaultPrefs, skins, usePrefs, type Skin } from './fx'
import { IconBell, IconColour, IconGrid, IconList, IconMotion, IconSun } from './icons'
import { getTheme, setTheme, type Theme } from './ui'

const EVT = 'tivan-settings'

/** Settings that need no account: look and feel, motion, lists and alerts. Everything is kept in this browser. */
export function SettingsSheet() {
  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = usePrefs()
  const [notif, setNotif] = useState(notifyState)
  const ref = useRef<HTMLDivElement>(null)
  const theme = getTheme()
  const close = () => setOpen(false)

  useEffect(() => {
    const show = () => (setNotif(notifyState()), setOpen(true))
    window.addEventListener(EVT, show)
    return () => window.removeEventListener(EVT, show)
  }, [])

  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('button')?.focus()
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setOpen(false)
      if (e.key !== 'Tab' || !ref.current) return
      const f = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), select')]
      if (!f.length) return
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === f[0]) (e.preventDefault(), last.focus())
      else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), f[0].focus())
    }
    addEventListener('keydown', keys)
    document.body.style.overflow = 'hidden'
    return () => (removeEventListener('keydown', keys), (document.body.style.overflow = ''), before?.focus())
  }, [open])

  if (!open) return null
  const setT = (t: Theme) => (setTheme(t), setPrefs({}))
  const reset = () => (setTheme('auto'), setPrefs(defaultPrefs()))
  return (
    <>
      <div className="settings-backdrop" onClick={close} />
      <div className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" ref={ref}>
        <div className="settings-head">
          <h2 id="settings-title">Settings</h2>
          <button className="ghost line" onClick={close}>
            Done
          </button>
        </div>
        <p className="fine" style={{ marginTop: 4 }}>Saved in this browser. No account needed.</p>

        <h3 className="settings-h">Appearance</h3>
        <div className="settings-group">
          <div className="settings-row">
            <span className="row-ico"><IconSun /></span>
            <span className="row-text">Light or dark<small>Auto follows your device</small></span>
            <span className="seg" role="radiogroup" aria-label="Appearance">
              {(['auto', 'light', 'dark'] as const).map((t) => (
                <button key={t} role="radio" aria-checked={theme === t} className={theme === t ? 'on' : ''} onClick={() => setT(t)}>
                  {t[0].toUpperCase() + t.slice(1)}
                </button>
              ))}
            </span>
          </div>
          <div className="settings-row" style={{ display: 'block' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="row-ico"><IconColour /></span>
              <span className="row-text">Colour theme<small>{prefs.skin === 'card' ? 'Each page takes its colour from the card on it' : 'One colour theme everywhere'}</small></span>
            </div>
            <div className="swatches" role="group" aria-label="Colour theme">
              {skins.map((s) => (
                <button key={s.id} className={`swatch ${s.id === 'card' ? 'swatch-card' : ''}`} aria-pressed={prefs.skin === s.id} onClick={() => setPrefs({ skin: s.id as Skin })}>
                  <i style={s.bg ? ({ '--c1': s.bg, '--c2': s.accent } as React.CSSProperties) : undefined} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <h3 className="settings-h">Motion</h3>
        <div className="settings-group">
          <div className="settings-row">
            <span className="row-ico"><IconMotion /></span>
            <span className="row-text">Reduce motion<small>Nothing slides or fades. Every state change is still shown</small></span>
            <button className="switch" role="switch" aria-checked={prefs.motion === 'off'} aria-label="Reduce motion" onClick={() => setPrefs({ motion: prefs.motion === 'off' ? 'full' : 'off' })} />
          </div>
        </div>

        <h3 className="settings-h">Lists</h3>
        <div className="settings-group">
          <div className="settings-row">
            <span className="row-ico"><IconGrid /></span>
            <span className="row-text">Markets layout</span>
            <span className="seg" role="radiogroup" aria-label="Markets layout">
              {(['grid', 'list'] as const).map((v) => (
                <button key={v} role="radio" aria-checked={prefs.view === v} className={prefs.view === v ? 'on' : ''} onClick={() => setPrefs({ view: v })}>
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </span>
          </div>
          <div className="settings-row">
            <span className="row-ico"><IconList /></span>
            <span className="row-text">Compact rows<small>Tighter spacing in list layout</small></span>
            <button className="switch" role="switch" aria-checked={prefs.dense} aria-label="Compact rows" onClick={() => setPrefs({ dense: !prefs.dense })} />
          </div>
        </div>

        <h3 className="settings-h">Alerts</h3>
        <div className="settings-group">
          <div className="settings-row">
            <span className="row-ico"><IconBell /></span>
            <span className="row-text">Price notifications<small>{canNotify() ? 'When a price you set is hit, while the app is open' : 'This browser does not support notifications'}</small></span>
            <button className={`pill ${notif === 'granted' ? 'on' : ''}`} disabled={notif !== 'default'} onClick={async () => (await askPermission(), setNotif(notifyState()))}>
              {notif === 'granted' ? 'On' : notif === 'denied' ? 'Blocked in browser' : 'Turn on'}
            </button>
          </div>
        </div>

        <button className="ghost line" style={{ marginTop: 22, width: '100%' }} onClick={reset}>
          Reset to defaults
        </button>
      </div>
    </>
  )
}
