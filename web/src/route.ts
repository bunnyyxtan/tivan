import { useEffect, useSyncExternalStore } from 'react'

// URL state lives in the hash query (`#/browse?cat=Magic&view=table`), so a reload or a shared link reproduces the page.
const EVT = 'tivan-query'
const subscribe = (cb: () => void) => {
  addEventListener('hashchange', cb)
  addEventListener(EVT, cb)
  return () => (removeEventListener('hashchange', cb), removeEventListener(EVT, cb))
}
export const routeOf = (hash: string) => hash.replace(/^#\/?/, '').split('?')[0].split('/')[0]

export function useQuery() {
  const h = useSyncExternalStore(subscribe, () => location.hash)
  return new URLSearchParams(h.split('?')[1] ?? '')
}

/** Change query keys in place: replaces the history entry, so filtering does not fill the back button. */
export function setQuery(patch: Record<string, string | undefined>) {
  const [path, qs = ''] = location.hash.split('?')
  const p = new URLSearchParams(qs)
  for (const [k, v] of Object.entries(patch)) v ? p.set(k, v) : p.delete(k)
  const s = p.toString()
  history.replaceState(null, '', (path || '#/') + (s ? '?' + s : ''))
  dispatchEvent(new Event(EVT))
}

export const WIDE = '(min-width: 1024px)'
/** True from 1024px up: the desktop composition. Below it the same state drives phone layouts and drawers. */
export const useWide = () =>
  useSyncExternalStore(
    (cb) => (matchMedia(WIDE).addEventListener('change', cb), () => matchMedia(WIDE).removeEventListener('change', cb)),
    () => matchMedia(WIDE).matches,
  )

// Returning from a card to a list puts the list back where it was. Lists load async, so the hook re-applies once data is in.
const KEY = 'tivan.scroll'
let pendingY: number | undefined
/** Scroll position for a hash change: remembered for lists, restored when coming back from a card, else the top. */
export function scrollFor(e: HashChangeEvent) {
  const old = new URL(e.oldURL).hash
  const list = (h: string) => ['', 'browse'].includes(routeOf(h))
  try {
    if (list(old)) sessionStorage.setItem(KEY, JSON.stringify({ h: old, y: scrollY }))
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (routeOf(old) === 'card' && list(location.hash) && saved?.h === location.hash) return (pendingY = saved.y as number)
  } catch {}
  pendingY = undefined
  return 0
}
export function useRestoreScroll(ready: boolean) {
  useEffect(() => {
    if (ready && pendingY !== undefined) (scrollTo(0, pendingY), (pendingY = undefined))
  }, [ready])
}
