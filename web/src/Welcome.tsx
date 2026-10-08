import { useEffect, useRef, useState } from 'react'
import { Button } from './controls'

/** One calm welcome the first time an account opens on this device. It asks for nothing and can be closed at once. */
const KEY = 'tivan.welcomed'
export function Welcome() {
  const dlg = useRef<HTMLDialogElement>(null)
  const [show, setShow] = useState(() => localStorage.getItem(KEY) !== '1')
  useEffect(() => {
    if (show) setTimeout(() => dlg.current && !dlg.current.open && dlg.current.showModal(), 400)
  }, [show])
  const done = (to?: string) => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {}
    dlg.current?.close()
    setShow(false)
    if (to) location.hash = to
  }
  if (!show) return null
  return (
    <dialog ref={dlg} className="kbd-dialog" aria-labelledby="wel-title" onCancel={() => done()}>
      <h2 id="wel-title">Welcome to Tivan</h2>
      <p>Your account is ready. It was made on this device and opens with your passkey. Nothing has been spent.</p>
      <p className="fine">A short Get started list is waiting on your Portfolio: add cash, make a first offer or buy, vault a card, and set a price alert. None of it is required.</p>
      <div className="tx-actions">
        <Button size={40} autoFocus onClick={() => done('#/collection')}>See Get started</Button>
        <Button variant="tertiary" size={40} onClick={() => done()}>Look around</Button>
      </div>
    </dialog>
  )
}
