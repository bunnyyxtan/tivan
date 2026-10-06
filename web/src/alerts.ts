import { useEffect, useState } from 'react'
import { loadSkus } from './chain'
import { cardTitle, usePoll } from './ui'

// Alerts live in this browser and fire while Tivan is open (checked every 20 s), then turn themselves off.
// Limit: no push. Alerts that reach a closed tab need a server worker and a push subscription.
export type Alert = { sku: string; kind: 'below' | 'listed' | 'bid'; price?: number }
const KEY = 'tivan.alerts'
const EVT = 'tivan-alerts'

const read = (): Alert[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}
const write = (list: Alert[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {}
  window.dispatchEvent(new Event(EVT))
}

export const canNotify = () => typeof Notification !== 'undefined'
export const notifyState = () => (canNotify() ? Notification.permission : 'denied')
export const askPermission = async () => canNotify() && (Notification.permission === 'granted' || (await Notification.requestPermission()) === 'granted')

export function useAlerts() {
  const [list, setList] = useState(read)
  useEffect(() => {
    const sync = () => setList(read())
    window.addEventListener(EVT, sync)
    return () => window.removeEventListener(EVT, sync)
  }, [])
  const has = (sku: string, kind: Alert['kind']) => list.find((a) => a.sku === sku && a.kind === kind)
  const off = (sku: string, kind: Alert['kind']) => write(read().filter((a) => !(a.sku === sku && a.kind === kind)))
  /** Turns an alert on (asking the browser for permission first); false if notifications are blocked. */
  const on = async (a: Alert) => {
    if (!(await askPermission())) return false
    write([...read().filter((x) => !(x.sku === a.sku && x.kind === a.kind)), a])
    return true
  }
  return { list, has, on, off }
}

/** "Under $5,000": the next round number below the ask, so the alert means something. */
export const alertPrice = (ask: number) => {
  const step = 10 ** Math.max(0, Math.floor(Math.log10(ask)) - 1)
  return Math.floor((ask * 0.97) / step) * step || undefined
}

/** Mounted once in App: checks every alert against the live books. */
export function useAlertWatcher() {
  usePoll(
    async () => {
      const list = read()
      if (!list.length || notifyState() !== 'granted') return
      const skus = await loadSkus()
      const hit = (a: Alert, s: (typeof skus)[number]) =>
        a.kind === 'below' ? !!s.ask && s.ask < a.price! : a.kind === 'listed' ? !!s.ask : !!s.bid && s.bid > a.price!
      const fired = list.filter((a) => {
        const s = skus.find((x) => x.sku === a.sku)
        if (!s || !hit(a, s)) return false
        const body =
          a.kind === 'below' ? `Now ${s.ask!.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} to buy.` : a.kind === 'listed' ? 'One is listed now.' : 'Someone is offering more than you paid.'
        new Notification(cardTitle(s.name), { body })
        return true
      })
      if (fired.length) write(read().filter((a) => !fired.some((f) => f.sku === a.sku && f.kind === a.kind)))
    },
    20000,
    [],
  )
}
