import { useEffect, useState } from 'react'

// What you did on this device, newest first. Limit: this browser only; the Envio indexer holds the full history.
export type Activity = { text: string; amount?: number; wait?: boolean; t: number }
const key = (me: string) => `tivan.activity.${me.toLowerCase()}`
const EVT = 'tivan-activity'

const read = (me: string): Activity[] => {
  try {
    return JSON.parse(localStorage.getItem(key(me)) ?? '[]')
  } catch {
    return []
  }
}

export function logActivity(me: string, a: Omit<Activity, 't'>) {
  try {
    localStorage.setItem(key(me), JSON.stringify([{ ...a, t: Date.now() }, ...read(me)].slice(0, 20)))
  } catch {}
  window.dispatchEvent(new Event(EVT))
}

export function useActivity(me: string) {
  const [list, setList] = useState(() => read(me))
  useEffect(() => {
    const sync = () => setList(read(me))
    window.addEventListener(EVT, sync)
    return () => window.removeEventListener(EVT, sync)
  }, [me])
  return list
}

export const when = (t: number) => {
  const d = new Date(t)
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString() ? `Today, ${time}` : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`
}
