import { useEffect, useSyncExternalStore } from 'react'

// Pages are real paths (`/browse?cat=Magic&view=table`), so a reload or a shared link reproduces the page. Vercel serves
// index.html for every path (web/vercel.json); old `#/…` links are moved to their path on load.
const EVT = 'tivan-nav'
if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1))
/** The current page as a path plus query, e.g. `/card/0xab…`. */
export const here = () => location.pathname + location.search
const subscribe = (cb: () => void) => {
  addEventListener('popstate', cb)
  addEventListener(EVT, cb)
  return () => (removeEventListener('popstate', cb), removeEventListener(EVT, cb))
}
export const onNav = subscribe
const routeOf = (path: string) => path.replace(/^[#/]+/, '').split('?')[0].split('/')[0]

let last = here()
/** The page before the latest change, for scroll memory. */
export const prev = () => last
const changed = () => {
  const p = last
  last = here()
  return p
}
/** Go to an in-app path, adding a history entry. */
export function navigate(to: string) {
  if (to === here()) return
  history.pushState(null, '', to)
  dispatchEvent(new Event(EVT))
}
// Same-origin links inside the app change the page in place instead of reloading it.
addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target as Element | null)?.closest?.('a')
  const href = a?.getAttribute('href')
  if (!a || !href?.startsWith('/') || href.startsWith('//') || a.target || a.hasAttribute('download') || /\.\w+$/.test(href.split('?')[0])) return
  e.preventDefault()
  navigate(href)
})

export function useQuery() {
  const h = useSyncExternalStore(subscribe, () => location.search)
  return new URLSearchParams(h)
}

/** Change query keys in place: replaces the history entry, so filtering does not fill the back button. */
export function setQuery(patch: Record<string, string | undefined>) {
  const p = new URLSearchParams(location.search)
  for (const [k, v] of Object.entries(patch)) v ? p.set(k, v) : p.delete(k)
  const s = p.toString()
  history.replaceState(null, '', location.pathname + (s ? '?' + s : ''))
  last = here()
  dispatchEvent(new Event(EVT))
}

const WIDE = '(min-width: 1024px)'
/** True from 1024px up: the desktop composition. Below it the same state drives phone layouts and drawers. */
export const useWide = () =>
  useSyncExternalStore(
    (cb) => (matchMedia(WIDE).addEventListener('change', cb), () => matchMedia(WIDE).removeEventListener('change', cb)),
    () => matchMedia(WIDE).matches,
  )

// Returning from a card to a list puts the list back where it was. Lists load async, so the hook re-applies once data is in.
const KEY = 'tivan.scroll'
let pendingY: number | undefined
/** Scroll position for a page change: remembered for lists, restored when coming back from a card, else the top. */
export function scrollFor() {
  const old = changed()
  const list = (h: string) => ['', 'browse'].includes(routeOf(h))
  try {
    if (list(old)) sessionStorage.setItem(KEY, JSON.stringify({ h: old, y: scrollY }))
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (routeOf(old) === 'card' && list(here()) && saved?.h === here()) return (pendingY = saved.y as number)
  } catch {}
  pendingY = undefined
  return 0
}
export function useRestoreScroll(ready: boolean) {
  useEffect(() => {
    if (ready && pendingY !== undefined) (scrollTo(0, pendingY), (pendingY = undefined))
  }, [ready])
}
