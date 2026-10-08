import { Component, useEffect, useState, type ReactNode } from 'react'
import { Button } from './controls'

/** Keeps one broken section from blanking the whole app; the rest of the page stays usable. */
export class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="state-block" role="alert">
        <h2>This part could not load</h2>
        <p>Nothing was spent. Your cash and cards are unchanged.</p>
        <Button variant="secondary" size={40} onClick={() => this.setState({ failed: false })}>Try again</Button>
      </div>
    )
  }
}

/** A quiet bar when the browser has no connection, so stale numbers are not mistaken for live ones. */
export function OfflineBar() {
  const [off, setOff] = useState(() => !navigator.onLine)
  useEffect(() => {
    const up = () => setOff(false)
    const down = () => setOff(true)
    addEventListener('online', up)
    addEventListener('offline', down)
    return () => (removeEventListener('online', up), removeEventListener('offline', down))
  }, [])
  return off ? <div className="offline-bar" role="status">You are offline. Prices and balances shown may be out of date, and trades cannot be sent.</div> : null
}
