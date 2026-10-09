import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { LocalAccount } from 'viem'
import { SESSION_MS, createAccount, deviceAccount, endSession, friendlyError, hasDeviceKey, restoreSession, savedPasskey, signIn, signOut } from './account'
import { openSettings } from './fx'
import { IconActivity, IconChevron, IconCollection, IconCompass, IconHelp, IconMarkets, IconSettings, IconTag, IconVault, IconYou } from './icons'
import { SettingsSheet } from './Settings'
import { attestorUrl, brand, net } from './config'
import { CardPage } from './Card'
import { League } from './League'
import { useAlertWatcher } from './alerts'
import { Redeem } from './Redeem'
import { Sell } from './Sell'
import { Slab } from './ui'
import { scrollFor } from './route'
import { Browse, Compare, Discover } from './Browse'
import { AccountMenu, DemoStrip, SearchBox, Shortcuts } from './desk'
import { Portfolio } from './Holdings'
import { AccountPage } from './AccountPage'
import { Activity } from './ActivityPage'
import { TxChip } from './tx'
import { Palette } from './Palette'
import { HelpPage } from './Help'
import { Boundary, OfflineBar } from './Boundary'
import { Tour } from './Tour'
import { Landing } from './Landing'
import { Welcome } from './Welcome'
import { BalancePill, CashSheet } from './Cash'
import { StatusBar } from './StatusBar'

function useHash() {
  const [h, setH] = useState(location.hash)
  useEffect(() => {
    // NOTE: the browser morphs any element sharing a view-transition-name (the card image) between pages.
    // Limit: Chromium/Safari only; elsewhere, and with reduced motion, the page just changes.
    const on = (e: HashChangeEvent) => {
      const y = scrollFor(e)
      const go = () => (flushSync(() => setH(location.hash)), window.scrollTo(0, y))
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches
      if (document.startViewTransition && !still) document.startViewTransition(go)
      else go()
    }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return h.replace(/^#\/?/, '').split('?')[0].split('/')
}

export type Acct = LocalAccount | undefined

export default function App() {
  const [account, setAccount] = useState<LocalAccount>()
  // Stay signed in across refreshes: the key kept on this device is restored before the first screen is drawn.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    restoreSession().then((r) => (r.account && setAccount(r.account), setEndsAt(r.endsAt), setEnded(r.ended), setReady(true)))
  }, [])
  // The session ends on time even while the app is open: the kept key is deleted and the next action asks for the passkey.
  const [endsAt, setEndsAt] = useState<number>()
  const [ended, setEnded] = useState(false)
  useEffect(() => {
    if (!endsAt || !account) return
    const id = setTimeout(() => (void endSession(), setAccount(undefined), setEnded(true)), Math.min(Math.max(0, endsAt - Date.now()), 2 ** 31 - 1))
    return () => clearTimeout(id)
  }, [endsAt, account])
  const login = (a: LocalAccount) => (setAccount(a), setEndsAt(Date.now() + SESSION_MS), setEnded(false))
  const [rail, setRail] = useState(() => {
    try {
      return localStorage.getItem('tivan.rail') === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem('tivan.rail', rail ? '1' : '0')
    } catch {}
  }, [rail])
  const [route, ...args] = useHash()
  useAlertWatcher()
  // Signing in at an action point returns to that exact place, with what was typed kept.
  useEffect(() => {
    if (!account) return
    const r = sessionStorage.getItem('tivan.returnTo')
    if (!r) return
    sessionStorage.removeItem('tivan.returnTo')
    try {
      location.hash = JSON.parse(r).hash
    } catch {}
  }, [account])
  // Free hosting sleeps when idle and takes ~a minute to wake: ring the attestor as soon as anyone opens the app, so it is
  // awake by the time they ask for gas.
  useEffect(() => void fetch(`${attestorUrl}/health`).catch(() => {}), [])
  const tab = route === 'browse' || route === 'compare' ? 'browse' : route === 'activity' ? 'activity' : route === 'collection' ? 'collection' : route === 'sell' ? 'sell' : route === 'vault' ? 'vault' : route === 'you' ? 'you' : route === 'help' ? 'help' : route === 'league' ? 'league' : 'markets'
  // Browsing is open to everyone; anything that moves money or cards asks for a passkey first.
  const out = () => (void signOut(), setAccount(undefined), (location.hash = '#/'))
  const need = (el: (a: LocalAccount) => React.ReactNode) => (account ? el(account) : <SignIn onReady={login} ended={ended} />)
  const page =
    route === 'card' ? <CardPage sku={args[0]} account={account} />
    : (route === 'buy' || route === 'sell' || route === 'offer' || route === 'done') && args[0] ? <CardPage sku={args[0]} account={account} />
    : route === 'redeem' ? need((a) => <Redeem sku={args[0]} account={a} />)
    : route === 'collection' ? need((a) => <Portfolio account={a} />)
    : route === 'activity' ? need((a) => <Activity account={a} />)
    : route === 'browse' ? <Browse account={account} />
    : route === 'compare' ? <Compare />
    : route === 'sell' ? need((a) => <Sell account={a} />)
    : route === 'vault' ? need((a) => <Sell account={a} mode="vault" />)
    : route === 'league' ? <League account={account} />
    : route === 'you' ? need((a) => <AccountPage account={a} onSignOut={out} />)
    : route === 'help' ? <HelpPage />
    : <Discover account={account} />
  if (!ready) return null
  // The site root is always the public front page; the app lives at #/markets. Sessions persist, so sending signed-in
  // people straight to the app would hide the front page from anyone who has ever signed in.
  if (route === '')
    return (
      <>
        <SettingsSheet />
        <Palette signedIn={!!account} />
        <Landing signedIn={!!account} />
      </>
    )
  const nav = [
    ['markets', '#/markets', 'Markets', <IconMarkets />],
    ['browse', '#/browse', 'Browse', <IconCompass />],
    ['collection', '#/collection', 'Portfolio', <IconCollection />],
    ['activity', '#/activity', 'Activity', <IconActivity />],
    ['sell', '#/sell', 'Sell', <IconTag />],
    ['vault', '#/vault', 'Vault a card', <IconVault />],
  ] as const
  const tabs = [nav[0], nav[1], nav[2], nav[4], ['you', '#/you', 'Account', <IconYou />]] as const
  return (
    <>
      <SettingsSheet />
      <Shortcuts />
      <Palette signedIn={!!account} />
      {account && <CashSheet account={account} />}
      {account && <Welcome />}
      <Tour />
      <div className="shell" data-rail={rail ? 'mini' : undefined}>
        <aside className="side" aria-label="Sidebar">
          <div className="side-top">
            <a className="brand side-brand" href="#/markets" aria-label={`${brand}, markets`}>
              <span className="brand-mark" aria-hidden>T</span>
              <span className="brand-word">{brand}</span>
            </a>
            <button className="side-fold" onClick={() => setRail(!rail)} aria-label={rail ? 'Expand the sidebar' : 'Collapse the sidebar'} aria-pressed={rail}>
              <IconChevron />
            </button>
          </div>
          <nav className="side-nav" aria-label="Primary">
            {nav.map(([k, href, label, icon]) => (
              <a key={k} href={href} title={rail ? label : undefined} data-tour={k === 'browse' ? 'browse' : k === 'sell' ? 'sell' : undefined} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}>
                {icon}
                <span>{label}</span>
              </a>
            ))}
          </nav>
          <div className="side-low">
            <DemoStrip />
            <nav className="side-nav" aria-label="Support">
              <a href="#/help" title={rail ? 'Help' : undefined} className={tab === 'help' ? 'on' : ''} aria-current={tab === 'help' ? 'page' : undefined}><IconHelp /><span>Help</span></a>
              <button title={rail ? 'Settings' : undefined} onClick={openSettings}><IconSettings /><span>Settings</span></button>
            </nav>
          </div>
        </aside>
        <div className="mainc">
          <header className="top">
            <a className="brand top-brand" href="#/markets" aria-label={`${brand}, markets`}>
              <span className="brand-mark" aria-hidden>T</span>
            </a>
            <SearchBox />
            <div className="top-right">
              <TxChip />
              {account ? (
                <>
                  <CashPill account={account} />
                  <AccountMenu address={account.address} onSignOut={out} />
                </>
              ) : (
                <a className="btn md" href="#/you" data-tour="signin">Sign in</a>
              )}
            </div>
          </header>
          <OfflineBar />
          <main>
            <div className="page" key={`${route}/${args[0] ?? ''}`}>
              <Boundary key={`${route}/${args[0] ?? ''}`}>{page}</Boundary>
            </div>
          </main>
          <StatusBar />
        </div>
      </div>
      <nav className="tabbar" aria-label="Primary">
        {tabs.map(([k, href, label, icon]) => (
          <a key={k} href={href} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}>
            {icon}
            <span className="lbl">{label}</span>
          </a>
        ))}
      </nav>
    </>
  )
}

/** Cash at a glance, always one tap from adding more. */
export function CashPill({ account }: { account: Acct }) {
  return account ? <BalancePill account={account} /> : null
}

/** One calm sign-in card, shown wherever an action needs an account. Browsing never does. */
function SignIn({ onReady, ended }: { onReady: (a: LocalAccount) => void; ended?: boolean }) {
  const [err, setErr] = useState<string>()
  const [busy, setBusy] = useState(false)
  const returning = !!savedPasskey()
  const go = async (fn: () => Promise<LocalAccount>) => {
    setBusy(true)
    setErr(undefined)
    try {
      onReady(await fn())
    } catch (e) {
      console.error(e)
      setErr(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-art" aria-hidden>
          <Slab name="PSA 10 Base Set Charizard Holo" size="sm" />
        </div>
        <h1>{ended ? 'Your session ended' : returning ? 'Welcome back' : 'Sign in to trade'}</h1>
        <p className="gate-sub">{ended ? 'Sessions on a device last 7 days. Your passkey opens a new one; your account, cash and cards are exactly where you left them.' : 'Your passkey is your account: your device’s fingerprint, face or screen lock. Nothing to install and no seed phrase.'}</p>
        <div className="gate-actions">
          {returning ? (
            <button className="btn wide" disabled={busy} onClick={() => go(signIn)}>
              {busy ? <span className="spin" aria-hidden /> : null}
              Continue with your passkey
            </button>
          ) : (
            <button className="btn wide" disabled={busy} onClick={() => go(() => createAccount(`Collector ${new Date().toLocaleDateString()}`))}>
              {busy ? <span className="spin" aria-hidden /> : null}
              Create an account with a passkey
            </button>
          )}
          <button className="ghost line wide" disabled={busy} onClick={() => go(returning ? () => signIn(true) : signIn)}>
            {returning ? 'Use a different passkey' : 'I already have an account'}
          </button>
          {net.name === 'testnet' && (err || hasDeviceKey()) && (
            <button className="ghost wide" disabled={busy} onClick={() => go(async () => deviceAccount())}>
              {hasDeviceKey() ? 'Continue with this device’s test account' : 'Continue without a passkey (test mode)'}
            </button>
          )}
          {err && <p className="error" role="alert">{err}</p>}
        </div>
        <ul className="gate-points">
          <li><b>Browsing is open.</b> Prices, order books and trades need no account.</li>
          <li><b>You hold the key.</b> It is made on this device and stays on it.</li>
          {net.name === 'testnet' && <li><b>Test network.</b> Cash and custody are simulated and have no value.</li>}
        </ul>
      </div>
    </div>
  )
}
