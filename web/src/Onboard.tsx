import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { LocalAccount } from 'viem'
import { isMeraError } from '@category-labs/mera'
import { createAccount, deviceAccount, hasDeviceKey, savedPasskey, signIn } from './account'
import { brand, net } from './config'
import { openSettings } from './fx'
import { IconClose } from './icons'
import { Viewer } from './Market'
import { DemoStrip } from './desk'
import { Slab, cardSub, cardTitle } from './ui'

const DESK = '(min-width: 900px)'
/** The two-column onboarding is for 900px and up; below it the original stacked screen is used unchanged. */
export const useOnboardWide = () =>
  useSyncExternalStore(
    (cb) => (matchMedia(DESK).addEventListener('change', cb), () => matchMedia(DESK).removeEventListener('change', cb)),
    () => matchMedia(DESK).matches,
  )

// The hero is an example listing, not live data, and says so beside its caption.
const EXAMPLE = 'PSA 10 Base Set Charizard Holo'
const WAIT_MS = 60_000

type Flow = 'create' | 'signin'
type St = { k: 'idle' } | { k: 'waiting'; flow: Flow } | { k: 'cancelled' } | { k: 'unsupported' } | { k: 'timeout' } | { k: 'failed'; reason: string } | { k: 'success' }

// The passkey library wraps what the browser threw, so read the original error underneath.
const root = (e: unknown) => (e as { cause?: unknown })?.cause ?? e
const named = (e: unknown) => (root(e) as { name?: string })?.name ?? ''
const isCancel = (e: unknown) => ['NotAllowedError', 'AbortError'].includes(named(e)) || /cancel|abort/i.test((root(e) as Error)?.message ?? '')

/** Turns whatever the browser or the passkey library threw into one of the states the screen can show. Raw text is never shown. */
function classify(e: unknown, took: number): St {
  if ((e as Error)?.message === 'TIMEOUT' || (isCancel(e) && took >= WAIT_MS - 5000)) return { k: 'timeout' }
  if (typeof PublicKeyCredential === 'undefined' || (isMeraError(e) && e.code === 'PRF_UNAVAILABLE')) return { k: 'unsupported' }
  if (isCancel(e)) return { k: 'cancelled' }
  const reason =
    named(e) === 'InvalidStateError' ? 'This device already has a passkey for Tivan.'
    : named(e) === 'SecurityError' ? 'Passkeys only work on the site’s own secure address, and this page is not on one.'
    : named(e) === 'NetworkError' ? 'The device could not reach its passkey provider.'
    : 'The device did not complete the request.'
  return { k: 'failed', reason }
}

export function Onboard({ onReady, onGuest }: { onReady: (a: LocalAccount) => void; onGuest: () => void }) {
  const [st, setSt] = useState<St>(() => (typeof PublicKeyCredential === 'undefined' ? { k: 'unsupported' } : { k: 'idle' }))
  const [open, setOpen] = useState(false)
  const last = useRef<() => void>(() => {})
  const inspect = useRef<HTMLButtonElement>(null)
  const dlg = useRef<HTMLDialogElement>(null)
  const returning = !!savedPasskey()
  const busy = st.k === 'waiting' || st.k === 'success'
  const noPasskeys = typeof PublicKeyCredential === 'undefined'

  const run = (flow: Flow, fn: () => Promise<LocalAccount>, passkey = true) => {
    last.current = () => run(flow, fn, passkey)
    if (busy || (noPasskeys && passkey)) return
    const t0 = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined
    setSt({ k: 'waiting', flow })
    Promise.race([fn(), new Promise<never>((_, no) => (timer = setTimeout(() => no(new Error('TIMEOUT')), WAIT_MS)))]).then(
      (a) => {
        clearTimeout(timer)
        setSt({ k: 'success' })
        setTimeout(() => onReady(a), 500)
      },
      (e) => {
        clearTimeout(timer)
        console.error(e)
        setSt(classify(e, Date.now() - t0))
      },
    )
  }
  const create = () => run('create', () => createAccount(`Collector ${new Date().toLocaleDateString()}`))
  const login = (pick = false) => run('signin', () => signIn(pick))
  const test = () => run('signin', async () => deviceAccount(), false)
  const showTest = net.name === 'testnet' && (hasDeviceKey() || st.k === 'unsupported' || st.k === 'failed')

  const message = () => {
    switch (st.k) {
      case 'waiting':
        return <p>Waiting for your device</p>
      case 'success':
        return <p>Signed in. Opening {brand}.</p>
      case 'cancelled':
        return <p>No passkey was used and nothing changed. Try again when you are ready.</p>
      case 'timeout':
        return (
          <p>
            Your device did not respond in time. <button className="linkbtn" onClick={() => last.current()}>Try again</button>
          </p>
        )
      case 'unsupported':
        return <p>This browser cannot create a passkey with the features {brand} needs. Open {brand} in Chrome, Edge or Safari on a device that has a screen lock set up.</p>
      case 'failed':
        return (
          <p className="error">
            We could not confirm your passkey. {st.reason} If you have signed in on this device before, choose “I already have an account”.{' '}
            <button className="linkbtn" onClick={() => last.current()}>Try again</button>
          </p>
        )
      default:
        return null
    }
  }

  useEffect(() => {
    if (open && !dlg.current?.open) dlg.current?.showModal()
  }, [open])
  const close = () => dlg.current?.close()
  return (
    <div className="onb">
      <DemoStrip />
      <header className="onb-bar">
        <div className="onb-in">
          <span className="brand">{brand}</span>
          <button className="linkbtn quiet" onClick={onGuest}>
            Look around first
          </button>
        </div>
      </header>
      <main className="onb-main">
        <div className="onb-grid">
          <section className="onb-copy" aria-label="Sign in">
            <h1>
              Own the card.
              <br />
              Trade it in a second.
            </h1>
            <p className="lead">Real graded cards, kept in a vault. Buy and sell them like stocks. Ask for the slab whenever you want it.</p>
            <div className="onb-actions">
              <button className="btn" aria-busy={st.k === 'waiting'} onClick={returning ? () => login() : create}>
                {st.k === 'waiting' ? <span className="spin" aria-hidden /> : null}
                {returning ? 'Continue with your passkey' : 'Continue with a passkey'}
              </button>
              <button className="ghost line" onClick={() => (returning ? login(true) : login())}>
                {returning ? 'Use a different passkey' : 'I already have an account'}
              </button>
              {showTest && (
                <button className="linkbtn quiet" onClick={test}>
                  {hasDeviceKey() ? 'Continue with this device’s test account' : 'Continue without a passkey (test mode)'}
                </button>
              )}
            </div>
            <div className="onb-status" role="status" aria-live="polite">
              {message()}
            </div>
            <p className="fine onb-fine">Sign in with your device’s fingerprint, face recognition, or screen lock. No seed phrase, nothing to install.</p>
          </section>
          <section className="onb-hero" aria-label="Example card">
            <div className="onb-art">
              <Slab name={EXAMPLE} size="xl" alt="PSA 10 graded slab holding a Base Set 1999 Charizard Holo card" />
            </div>
            <p className="onb-cap">
              <span>
                {cardSub(EXAMPLE)} · {cardTitle(EXAMPLE)}
              </span>
              <span className="tagline">Example listing</span>
              <button
                ref={inspect}
                className="linkbtn"
                onClick={() => setOpen(true)}
              >
                Inspect
              </button>
            </p>
          </section>
        </div>
      </main>
      <section className="onb-how" aria-labelledby="how">
        <h2 id="how">How it works</h2>
        <ol>
          <li>Choose a card and a grade. Each one has its own order book, priced in dollars.</li>
          <li>Buy at the lowest ask or make an offer. Trades settle on Monad in under a second.</li>
          <li>Your card stays in the vault. Ask for the physical slab whenever you want it.</li>
        </ol>
      </section>
      <footer className="onb-foot">
        <div className="onb-in">
          <span>{brand}</span>
          <span>
            <button className="linkbtn quiet" onClick={openSettings}>
              Settings
            </button>
            <a className="linkbtn quiet" href="https://github.com/bunnyyxtan/tivan" rel="noreferrer">
              Source on GitHub
            </a>
          </span>
        </div>
      </footer>
      <dialog
        ref={dlg}
        className="inspect"
        aria-label="Inspect the example card"
        onClose={() => (setOpen(false), inspect.current?.focus())}
        onClick={(e) => e.target === dlg.current && close()}
      >
        {open && (
          <>
            <button className="ghost line close" autoFocus onClick={close}>
              <IconClose size={16} /> Close
            </button>
            <Viewer s={{ name: EXAMPLE, sku: 'onboarding' }} />
          </>
        )}
      </dialog>
    </div>
  )
}
