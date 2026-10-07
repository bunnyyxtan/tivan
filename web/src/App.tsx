import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { formatEther, parseUnits, type LocalAccount } from 'viem'
import { createAccount, deviceAccount, friendlyError, hasDeviceKey, savedPasskey, signIn, signOut } from './account'
import { erc20Abi, marginAbi, pub, send } from './chain'
import { SettingsButton, openSettings } from './fx'
import { IconChevron, IconCollection, IconLeague, IconMarkets, IconSettings, IconVault, IconYou } from './icons'
import { SettingsSheet } from './Settings'
import { attestorUrl, brand, net } from './config'
import { CardPage, MarketList } from './Market'
import { BuyFlow, Receipt, TradeFlow } from './Trade'
import { Collection } from './Collection'
import { League } from './League'
import { logActivity, useActivity, when } from './activity'
import { askPermission, notifyState, useAlertWatcher } from './alerts'
import { Redeem, VaultPage, drip } from './Vault'
import { usePortfolio } from './portfolio'
import { Header, Slab, Steps, delta, short, useFlow, usd } from './ui'
import { scrollFor, useWide } from './route'
import { Browse, Compare, Discover } from './Browse'
import { SearchBox, Shortcuts, openShortcuts } from './desk'
import { Activity, Portfolio } from './Holdings'

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
  const tab = route === 'browse' || route === 'compare' ? 'browse' : route === 'activity' ? 'activity' : route === 'collection' ? 'collection' : route === 'vault' ? 'vault' : route === 'you' ? 'you' : route === 'league' ? 'league' : 'markets'
  // Browsing is open; anything that moves money or cards asks for a passkey first.
  const need = (el: (a: LocalAccount) => React.ReactNode) => (account ? el(account) : <SignIn inline onReady={setAccount} />)
  const page =
    route === 'card' ? <CardPage sku={args[0]} account={account} />
    : route === 'buy' ? need((a) => <BuyFlow sku={args[0]} account={a} />)
    : route === 'done' ? need((a) => <Receipt sku={args[0]} price={Number(args[1])} tx={args[2]} account={a} />)
    : route === 'sell' || route === 'offer' ? need((a) => <TradeFlow key={route} side={route} sku={args[0]} account={a} />)
    : route === 'redeem' ? need((a) => <Redeem sku={args[0]} account={a} />)
    : route === 'collection' ? need((a) => (wide ? <Portfolio account={a} /> : <Collection account={a} />))
    : route === 'activity' ? need((a) => <Activity account={a} />)
    : route === 'browse' ? <Browse account={account} />
    : route === 'compare' ? <Compare />
    : route === 'vault' ? need((a) => <VaultPage account={a} />)
    : route === 'league' ? <League account={account} />
    : route === 'you' ? need((a) => <You account={a} onSignOut={() => (signOut(), setAccount(undefined), setGuest(false), (location.hash = '#/'))} />)
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
    ['vault', '#/vault', 'Vault'],
  ] as const
  return (
    <>
      <SettingsSheet />
      <Shortcuts />
      <div className="desk-bar">
        <div className="desk-nav">
          <a className="brand" href="#/">
            {brand}
          </a>
          <nav aria-label="Primary">
            {deskTabs.map(([k, href, label]) => (
              <a key={k} href={href} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <SearchBox />
          <div className="right">
            <button className="icon-btn" aria-label="Keyboard shortcuts" onClick={openShortcuts}>
              ?
            </button>
            <SettingsButton />
            <CashPill account={account} />
            <a className="ghost line" href="#/you">
              {account ? 'You' : 'Sign in'}
            </a>
          </div>
        </div>
      </div>
      <div className="app">
        <main>
          <div className="page" key={`${route}/${args[0] ?? ''}`}>
            {page}
          </div>
        </main>
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
  const { totalCash } = usePortfolio(account?.address)
  if (!account) return null
  return (
    <a className="cash-pill" href="#/you" aria-label={`Cash ${usd(totalCash)}. Add cash`}>
      {usd(totalCash)}
      <span>Add</span>
    </a>
  )
}

function SignIn({ onReady, onGuest, inline }: { onReady: (a: LocalAccount) => void; onGuest?: () => void; inline?: boolean }) {
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
        Face ID or your fingerprint. No app to install, no seed phrase.
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
          Trade it in a second.
        </h1>
        <p className="lead">Real graded cards, kept in a vault. Buy and sell them like stocks. Ask for the slab whenever you want it.</p>
      </div>
      {actions}
    </div>
  )
}

function You({ account, onSignOut }: { account: LocalAccount; onSignOut: () => void }) {
  const me = account.address
  const { data, totalCash, bidCash, refresh } = usePortfolio(me, true)
  const flow = useFlow()
  const [copied, setCopied] = useState(false)
  const [notif, setNotif] = useState(notifyState)
  const recent = useActivity(me)
  const addFunds = async () => {
    const steps: [string, () => Promise<string | void>][] = []
    if ((data?.gas ?? 0n) < 5n * 10n ** 16n)
      // under 0.05 MON: a few orders' worth of network fees
      steps.push([
        'Network fees covered',
        async () => {
          const { txHash } = await drip(me)
          if (!txHash) return
          const r = await pub.waitForTransactionReceipt({ hash: txHash as `0x${string}` })
          // Monad checks a sender's balance against state a few blocks behind the tip, so let the drip settle.
          while ((await pub.getBlockNumber()) < r.blockNumber + 4n) await new Promise((ok) => setTimeout(ok, 400))
          return txHash
        },
      ])
    steps.push([
      '$10,000 in test dollars added',
      async () => (await send(account, { address: net.quote, abi: erc20Abi, functionName: 'mint', args: [me, parseUnits('10000', net.quoteDecimals)] })).transactionHash,
    ])
    if (await flow.run(steps)) {
      logActivity(me, { text: 'Added test cash', amount: 10000 })
      refresh()
    }
  }
  const toWallet = async () => {
    if (!data?.exCashRaw) return
    if (await flow.run([['Exchange cash moved to your balance', async () => (await send(account, { address: data.ma, abi: marginAbi, functionName: 'withdraw', args: [data.exCashRaw, net.quote] })).transactionHash]])) refresh()
  }
  return (
    <>
      <Header title="You" />
      <section className="panel">
        <span className="cap">Cash</span>
        <div className="big" style={{ fontSize: 44, marginTop: 4 }}>
          {usd(totalCash, 2)}
        </div>
        <p className="fine">
          Held as USDC, $1 each.
          {data && data.exCash > 0 ? ` ${usd(data.exCash, 2)} is free on the exchange.` : ''}
          {bidCash > 0 ? ` ${usd(bidCash)} is held for your offers.` : ''}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          {net.mintableQuote ? (
            <button className="btn" disabled={flow.busy || !data} onClick={addFunds}>
              {data ? 'Add test cash' : 'Loading balance…'}
            </button>
          ) : (
            <button className="btn" onClick={() => (navigator.clipboard?.writeText(me), setCopied(true), setTimeout(() => setCopied(false), 1500))}>
              {copied ? 'Address copied' : 'Add USDC'}
            </button>
          )}
          <button className="ghost line" disabled={flow.busy || !data?.exCash} onClick={toWallet}>
            Move to wallet
          </button>
        </div>
        {!net.mintableQuote && <p className="fine" style={{ marginTop: 10 }}>Send USDC on Monad to your address. Only USDC on Monad.</p>}
        <div style={{ marginTop: 12 }}>
          <Steps steps={flow.steps} error={flow.error} />
        </div>
      </section>

      <div className="settings-group" style={{ marginTop: 14 }}>
        {([['#/collection', <IconCollection />, 'Collection', 'What you own, paid and worth'], ['#/vault', <IconVault />, 'Vault a card', 'Check a cert, list it'], ['#/league', <IconLeague />, 'Price League', 'See the standings']] as const).map(([href, ico, t, d]) => (
          <a key={href} className="settings-row" href={href}>
            <span className="row-ico">{ico}</span>
            <span className="row-text">{t}<small>{d}</small></span>
            <IconChevron />
          </a>
        ))}
        <button className="settings-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => (navigator.clipboard?.writeText(location.href.split('#')[0]), setCopied(true), setTimeout(() => setCopied(false), 1500))}>
          <span className="row-ico"><IconYou /></span>
          <span className="row-text">{copied ? 'Link copied' : 'Invite a friend'}<small>Share {brand} with a collector</small></span>
        </button>
        <button className="settings-row" style={{ width: '100%', textAlign: 'left' }} onClick={openSettings}>
          <span className="row-ico"><IconSettings /></span>
          <span className="row-text">Settings<small>Motion, lists, alerts</small></span>
          <IconChevron />
        </button>
      </div>

      {recent.length > 0 && (
        <section className="section">
          <span className="cap">Recent</span>
          <div className="rows">
            {recent.slice(0, 3).map((a) => (
              <div className="kv" key={a.t}>
                <span>
                  {a.text}
                  <span className="fine" style={{ display: 'block' }}>
                    {when(a.t)}
                    {a.wait ? ' · waiting' : ''}
                  </span>
                </span>
                <span>{a.amount === undefined ? '' : a.wait ? usd(a.amount) : delta(a.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <span className="cap">Sign-in and settings</span>
        <div className="rows">
          <div className="kv">
            <span>Account</span>
            <button className="u" onClick={() => (navigator.clipboard?.writeText(me), setCopied(true), setTimeout(() => setCopied(false), 1500))}>
              {copied ? 'Copied' : short(me)}
            </button>
          </div>
          <div className="kv">
            <span>Signed in with</span>
            <span>{account.source === 'mera' ? 'Passkey' : 'This device (test mode)'}</span>
          </div>
          {account.source === 'mera' && (
            <div className="kv">
              <span>Passkey</span>
              <span style={{ textAlign: 'right' }}>Syncs to your other devices with iCloud Keychain or Google Password Manager</span>
            </div>
          )}
          <div className="kv" style={{ alignItems: 'center' }}>
            <span>Notifications</span>
            <button className={`pill ${notif === 'granted' ? 'on' : ''}`} disabled={notif !== 'default'} onClick={async () => (await askPermission(), setNotif(notifyState()))}>
              {notif === 'granted' ? 'On' : notif === 'denied' ? 'Blocked in browser' : 'Turn on'}
            </button>
          </div>
          <div className="kv">
            <span>Network fee balance</span>
            <span>{data ? `${Number(formatEther(data.gas)).toFixed(3)} MON` : '—'}</span>
          </div>
          <div className="kv">
            <span>Network</span>
            <span>{net.chain.name}</span>
          </div>
        </div>
      </section>
      <button className="ghost" style={{ marginTop: 18 }} onClick={onSignOut}>
        Sign out
      </button>
    </>
  )
}
