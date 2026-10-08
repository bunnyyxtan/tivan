import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import type { LocalAccount } from 'viem'
import { createAccount, deviceAccount, friendlyError, hasDeviceKey, savedPasskey, signIn, signOut } from './account'
import { SettingsButton } from './fx'
import { IconCollection, IconLeague, IconMarkets, IconVault, IconYou } from './icons'
import { SettingsSheet } from './Settings'
import { attestorUrl, brand, net } from './config'
import { MarketList } from './Market'
import { CardPage } from './Card'
import { League } from './League'
import { useAlertWatcher } from './alerts'
import { Redeem } from './Redeem'
import { Sell } from './Sell'
import { Slab } from './ui'
import { scrollFor, useWide } from './route'
import { Browse, Compare, Discover } from './Browse'
import { AccountMenu, DemoStrip, SearchBox, Shortcuts } from './desk'
import { Portfolio } from './Holdings'
import { AccountPage } from './AccountPage'
import { Activity } from './ActivityPage'
import { Onboard, useOnboardWide } from './Onboard'
import { TxChip } from './tx'
import { Palette } from './Palette'
import { HelpPage, SiteFooter } from './Help'
import { Boundary, OfflineBar } from './Boundary'
import { Tour } from './Tour'
import { Welcome } from './Welcome'
import { BalancePill, CashSheet, NetworkChip } from './Cash'

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
  const [guest, setGuest] = useState(false)
  const [route, ...args] = useHash()
  const wide = useWide()
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
  if (!account && !guest)
    return (
      <>
        <SignIn onReady={setAccount} onGuest={() => setGuest(true)} />
        <SettingsSheet />
      </>
    )
  const tab = route === 'browse' || route === 'compare' ? 'browse' : route === 'activity' ? 'activity' : route === 'collection' ? 'collection' : route === 'vault' || route === 'sell' ? 'vault' : route === 'you' ? 'you' : route === 'league' ? 'league' : 'markets'
  // Browsing is open; anything that moves money or cards asks for a passkey first.
  const out = () => (signOut(), setAccount(undefined), setGuest(false), (location.hash = '#/'))
  const acctRoute = route === 'league'
  const need = (el: (a: LocalAccount) => React.ReactNode) => (account ? el(account) : <SignIn inline onReady={setAccount} />)
  const page =
    route === 'card' ? <CardPage sku={args[0]} account={account} />
    : (route === 'buy' || route === 'sell' || route === 'offer' || route === 'done') && args[0] ? <CardPage sku={args[0]} account={account} />
    : route === 'redeem' ? need((a) => <Redeem sku={args[0]} account={a} />)
    : route === 'collection' ? need((a) => <Portfolio account={a} />)
    : route === 'activity' ? need((a) => <Activity account={a} />)
    : route === 'browse' ? <Browse account={account} />
    : route === 'compare' ? <Compare />
    : route === 'vault' || route === 'sell' ? need((a) => <Sell account={a} />)
    : route === 'league' ? <League account={account} />
    : route === 'you' ? need((a) => <AccountPage account={a} onSignOut={out} />)
    : route === 'help' ? <HelpPage />
    : wide ? <Discover account={account} /> : <MarketList account={account} />
  const tabs = [
    ['markets', '#/', 'Markets', <IconMarkets />],
    ['collection', '#/collection', 'Collection', <IconCollection />],
    ['vault', '#/vault', 'Vault', <IconVault />],
    ['league', '#/league', 'League', <IconLeague />],
    ['you', '#/you', 'You', <IconYou />],
  ] as const
  const deskTabs = [
    ['markets', '#/', 'Discover'],
    ['browse', '#/browse', 'Browse'],
    ['collection', '#/collection', 'Portfolio'],
    ['activity', '#/activity', 'Activity'],
    ['vault', '#/sell', 'Sell'],
  ] as const
  return (
    <>
      <SettingsSheet />
      <Shortcuts />
      <Palette signedIn={!!account} />
      {account && <CashSheet account={account} />}
      {account && <Welcome />}
      <Tour />
      <DemoStrip />
      <div className="desk-bar">
        <div className="desk-nav">
          <a className="brand" href="#/">
            {brand}
          </a>
          <nav aria-label="Primary">
            {deskTabs.map(([k, href, label]) => (
              <a key={k} href={href} data-tour={k === 'browse' ? 'browse' : k === 'vault' ? 'sell' : undefined} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <SearchBox />
          <div className="right">
            <NetworkChip />
            <TxChip />
            {account ? (
              <>
                <CashPill account={account} />
                <AccountMenu address={account.address} onSignOut={out} />
              </>
            ) : (
              <a className="btn md" href="#/you" data-tour="signin">
                Sign in
              </a>
            )}
          </div>
        </div>
      </div>
      <OfflineBar />
      <div className="app">
        <main>
          <div className="page" key={`${route}/${args[0] ?? ''}`}>
            <Boundary key={`${route}/${args[0] ?? ''}`}>
              {acctRoute ? (
                <div className="acct-page solo">
                  <div className="acct-col">{page}</div>
                </div>
              ) : (
                page
              )}
            </Boundary>
          </div>
        </main>
        <SiteFooter />
      </div>
      <nav className="tabbar" aria-label="Primary">
        {tabs.map(([k, href, label, icon]) => (
          <a key={k} href={href} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} aria-label={label}>
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

function SignIn({ onReady, onGuest, inline }: { onReady: (a: LocalAccount) => void; onGuest?: () => void; inline?: boolean }) {
  const desk = useOnboardWide()
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
  const actions = (
    <div className="signin-actions">
      {returning ? (
        <button className="btn wide" disabled={busy} onClick={() => go(signIn)}>
          {busy ? <span className="spin" aria-hidden /> : null}
          Continue with your passkey
        </button>
      ) : (
        <button className="btn wide" disabled={busy} onClick={() => go(() => createAccount(`Collector ${new Date().toLocaleDateString()}`))}>
          {busy ? <span className="spin" aria-hidden /> : null}
          Continue with a passkey
        </button>
      )}
      <button className="ghost" disabled={busy} onClick={() => go(returning ? () => signIn(true) : signIn)}>
        {returning ? 'Use a different passkey' : 'I already have an account'}
      </button>
      {net.name === 'testnet' && (err || hasDeviceKey()) && (
        <button className="ghost" disabled={busy} onClick={() => go(async () => deviceAccount())}>
          {hasDeviceKey() ? 'Continue with this device’s test account' : 'Continue without a passkey (test mode)'}
        </button>
      )}
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      <p className="fine" style={{ textAlign: 'center' }}>
        Your device’s fingerprint, face recognition or screen lock. No app to install, and no seed phrase needed to start.
      </p>
    </div>
  )
  if (inline)
    return (
      <div className="flow" style={{ paddingTop: 40 }}>
        <h1 className="big" style={{ fontSize: 32 }}>
          Sign in to continue
        </h1>
        <p className="muted">Your passkey is your account. It takes a few seconds.</p>
        {actions}
      </div>
    )
  if (desk && onGuest) return <Onboard onReady={onReady} onGuest={onGuest} />
  return (
    <div className="signin">
      <div className="signin-top">
        <span className="brand">{brand}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <SettingsButton />
          <button className="ghost" style={{ marginRight: -14, color: 'var(--ink-2)' }} onClick={onGuest}>
            Look around first
          </button>
        </span>
      </div>
      <div className="signin-hero">
        <Slab name="PSA 10 Base Set Charizard Holo" size="lg" />
      </div>
      <div className="rise">
        <h1>
          Own the card.
          <br />
          Trade it any time.
        </h1>
        <p className="lead">Graded cards held in a vault, each with its own live order book. Buy and sell whenever you like, and request the physical slab when you want it.</p>
      </div>
      {actions}
    </div>
  )
}
