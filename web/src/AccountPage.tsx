import { useEffect, useRef, useState } from 'react'
import { PageHead } from './kit'
import type { LocalAccount } from 'viem'
import { askPermission, canNotify, notifyState } from './alerts'
import { cents } from './cardParts'
import { DepositAddress, openCash, reservedUnits } from './Cash'
import { Button, Copyable, Seg } from './controls'
import { savedPasskey } from './account'
import { net } from './config'
import { openShortcuts } from './desk'
import { canBuzz, usePrefs } from './fx'
import { exportKeyBytes, keyText } from './keyExport'
import { myTrades } from './chain'
import { formatUsd, toDecimal } from './logic/money.ts'
import { portfolioValue } from './logic/orders.ts'
import { usePortfolio } from './portfolio'
import { useTxLog } from './tx'
import { short } from './ui'

const usd = (u: bigint, d: 'auto' | 2 = 'auto') => formatUsd(u, { digits: d })
const SECTIONS = [['overview', 'Overview'], ['security', 'Sign-in and security'], ['deposit', 'Deposit address'], ['notifications', 'Notifications'], ['appearance', 'Appearance'], ['data', 'Data'], ['help', 'Help']] as const

export function AccountPage({ account, onSignOut }: { account: LocalAccount; onSignOut: () => void }) {
  const [on, setOn] = useState<string>('overview')
  useEffect(() => {
    const els = SECTIONS.map(([k]) => document.getElementById(`acc-${k}`)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setOn(e.target.id.replace('acc-', ''))), { rootMargin: '-20% 0px -70% 0px' })
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])
  return (
    <div className="acct-page">
      <nav className="subnav" aria-label="Account sections">
        {SECTIONS.map(([k, l]) => (
          <button key={k} aria-current={on === k ? 'true' : undefined} onClick={() => document.getElementById(`acc-${k}`)?.scrollIntoView({ behavior: 'smooth' })}>
            {l}
          </button>
        ))}
        <hr />
        <button onClick={onSignOut}>Sign out</button>
      </nav>
      <div className="acct-col">
        <PageHead title="Account" sub="Your address, security, alerts and appearance" />
        <Overview account={account} />
        <Security account={account} />
        <section id="acc-deposit" className="acc-sec" aria-labelledby="h-deposit">
          <h2 id="h-deposit">Deposit address and network</h2>
          <p className="fine">Anyone can send USDC to this address, from any wallet on {net.chain.name}. It is your account’s own address, made on this device. We do not hold a copy of its key.</p>
          <DepositAddress account={account} />
        </section>
        <Notifications />
        <Appearance />
        <DataExport account={account} />
        <section id="acc-help" className="acc-sec" aria-labelledby="h-help">
          <h2 id="h-help">Help</h2>
          <p><button className="linkbtn" onClick={openShortcuts}>Keyboard shortcuts</button></p>
          <p><a className="u" href="#/help">Help center</a></p>
        </section>
        <details className="acc-adv">
          <summary>Advanced</summary>
          <dl className="tx-rows">
            <div><dt>Address</dt><dd><Copyable value={account.address} label="address" /></dd></div>
            <div><dt>Network</dt><dd>{net.chain.name}, chain ID {net.chain.id}</dd></div>
            <div><dt>Signing</dt><dd>{account.source === 'mera' ? 'Passkey on this device' : 'Test key stored in this browser'}</dd></div>
          </dl>
        </details>
        <hr className="acc-sep" />
        <Button variant="secondary" size={40} onClick={onSignOut}>Sign out</Button>
      </div>
    </div>
  )
}

function Overview({ account }: { account: LocalAccount }) {
  const p = usePortfolio(account.address, true)
  const d = p.data
  const available = d ? d.cashRaw + d.exCashRaw : undefined
  const reserved = p.orders ? reservedUnits(p.orders) : undefined
  const v = d && available !== undefined ? portfolioValue(d.holdings.filter((h) => h.count > 0).map((h) => ({ qty: BigInt(h.count), markCents: h.s.bid ? cents(h.s.bid) : undefined })), available + (reserved ?? 0n)) : undefined
  return (
    <section id="acc-overview" className="acc-sec" aria-labelledby="h-overview">
      <h2 id="h-overview">Overview</h2>
      <dl className="tx-rows">
        <div><dt>Available cash</dt><dd>{available === undefined ? 'Checking…' : usd(available, 2)}</dd></div>
        <div><dt>Reserved in open offers</dt><dd>{reserved === undefined ? 'Checking…' : usd(reserved, 2)}</dd></div>
        <div><dt>Cards</dt><dd>{v ? usd(v.cards, 2) : 'Checking…'}<small>Valued at the best offer{v && v.unmarked ? `. ${v.unmarked} card${v.unmarked === 1 ? ' has' : 's have'} no offer, so ${v.unmarked === 1 ? 'it is' : 'they are'} left out` : ''}</small></dd></div>
        <div className="total"><dt>Total</dt><dd>{v ? usd(v.total, 2) : '—'}</dd></div>
      </dl>
      <p className="acc-links"><Button size={40} onClick={openCash}>Add cash</Button> <a className="ghost line s40" href="#/collection">Portfolio</a> <a className="ghost line s40" href="#/activity">Activity</a></p>
    </section>
  )
}

function Security({ account }: { account: LocalAccount }) {
  const pk = savedPasskey()
  return (
    <section id="acc-security" className="acc-sec" aria-labelledby="h-security">
      <h2 id="h-security">Sign-in and security</h2>
      <dl className="tx-rows">
        <div><dt>Signs in with</dt><dd>{account.source === 'mera' ? 'A passkey on this device' : 'A test account stored in this browser'}</dd></div>
        {pk?.credentialId && <div><dt>Passkey</dt><dd><span className="mono">{short(pk.credentialId)}</span><small>Syncs to your other devices if your password manager or platform syncs passkeys</small></dd></div>}
      </dl>
      <h3>A backup passkey</h3>
      <p className="fine">We do not offer one. Each passkey produces its own key, so a second passkey would open a different account with a different address and none of your cash. We can only offer a backup that opens this same account. To protect yourself, export your private key below and keep it somewhere safe, or move cash to your own wallet.</p>
      <KeyExport account={account} />
    </section>
  )
}

/** Shows the private key only after a fresh passkey check and a press-and-hold. It stays in memory, is zeroed when hidden, and is never logged. */
function KeyExport({ account }: { account: LocalAccount }) {
  const [phase, setPhase] = useState<'idle' | 'warn' | 'asking' | 'ready' | 'shown'>('idle')
  const [msg, setMsg] = useState<string>()
  const [held, setHeld] = useState(0)
  const bytes = useRef<Uint8Array | undefined>(undefined)
  const box = useRef<HTMLElement>(null)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const auto = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const decoy = useRef(Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''))
  const clear = () => {
    bytes.current?.fill(0)
    bytes.current = undefined
    if (box.current) box.current.textContent = ''
    clearInterval(timer.current)
    clearTimeout(auto.current)
    setHeld(0)
  }
  useEffect(() => clear, [])
  const ask = async () => {
    setPhase('asking')
    setMsg(undefined)
    try {
      bytes.current = await exportKeyBytes(account)
      setPhase('ready')
    } catch (e) {
      // Never show raw error text, and never put the key in a log line.
      const n = (e as { name?: string; cause?: { name?: string } })?.name ?? ''
      setMsg(n === 'NotAllowedError' || /cancel|not allowed|abort/i.test((e as Error).message ?? '') ? 'Nothing was exported: the passkey check was cancelled.' : (e as Error).message === 'KEY_MISMATCH' ? 'The passkey you used does not open this account, so nothing was shown.' : 'The passkey check did not complete, so nothing was shown. Try again.')
      setPhase('warn')
    }
  }
  const reveal = () => {
    if (!bytes.current || !box.current) return
    box.current.textContent = keyText(bytes.current)
    setPhase('shown')
    auto.current = setTimeout(hide, 60_000)
  }
  const startHold = () => {
    const t0 = Date.now()
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 1200)
      setHeld(p)
      if (p >= 1) (clearInterval(timer.current), reveal())
    }, 60)
  }
  const endHold = () => (clearInterval(timer.current), setHeld(0))
  const hide = () => {
    clear()
    setPhase('idle')
    setMsg('The key is hidden and cleared from this page.')
  }
  const copy = async () => {
    if (!bytes.current) return
    try {
      await navigator.clipboard.writeText(keyText(bytes.current))
      setMsg('Copied. Clear your clipboard when you are done. We will try to clear it in 30 seconds.')
      setTimeout(() => navigator.clipboard.writeText('').catch(() => {}), 30_000)
    } catch {
      setMsg('Copy was blocked. Select the key and copy it by hand.')
    }
  }
  return (
    <div className="keyexp">
      <h3>Export your private key</h3>
      {phase === 'idle' && (
        <>
          <p className="fine">This shows the private key behind your account. It is a private key, not a recovery phrase: this account has no seed phrase.</p>
          <Button variant="secondary" size={40} onClick={() => (setPhase('warn'), setMsg(undefined))}>Export private key</Button>
        </>
      )}
      {phase !== 'idle' && (
        <ul className="plain risk">
          <li>Anyone who sees this key controls your account and all its cash and cards, with no way to undo it.</li>
          <li>We cannot recover it for you and we never see it. It is never sent to a server or kept in a log.</li>
          <li>Do not screenshot it, paste it into a chat, or type it into any website.</li>
        </ul>
      )}
      {(phase === 'warn' || phase === 'asking') && (
        <Button variant="secondary" size={40} pending={phase === 'asking'} onClick={ask}>
          {account.source === 'mera' ? 'Check my passkey' : 'Show the test key'}
        </Button>
      )}
      {(phase === 'ready' || phase === 'shown') && (
        <>
          <code ref={box} className={`keybox ${phase === 'shown' ? '' : 'blurred'}`} aria-live="off">
            {phase === 'shown' ? '' : decoy.current}
          </code>
          {phase === 'ready' && (
            <button
              className="holdbtn"
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && (e.preventDefault(), startHold())}
              onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && endHold()}
              aria-label="Press and hold to reveal the key"
            >
              <i style={{ width: `${held * 100}%` }} aria-hidden />
              <span>Press and hold to reveal</span>
            </button>
          )}
          {phase === 'shown' && (
            <div className="tx-actions">
              <Button variant="secondary" size={40} onClick={copy}>Copy key</Button>
              <Button variant="tertiary" size={40} onClick={hide}>Hide and clear</Button>
            </div>
          )}
        </>
      )}
      {msg && <p className="fine" role="status">{msg}</p>}
    </div>
  )
}

function Notifications() {
  const [state, setState] = useState(notifyState)
  return (
    <section id="acc-notifications" className="acc-sec" aria-labelledby="h-notif">
      <h2 id="h-notif">Notifications</h2>
      <dl className="tx-rows">
        <div><dt>Price alerts</dt><dd>{canNotify() ? 'Work only while Tivan is open in a tab' : 'Not supported by this browser'}<small>They are not push notifications: a closed tab cannot receive them</small></dd></div>
        <div><dt>Offer filled</dt><dd>No notification yet<small>Fills appear in Activity</small></dd></div>
        <div><dt>Deposit received</dt><dd>No notification yet<small>Deposits appear in Activity</small></dd></div>
      </dl>
      {canNotify() && <Button variant="secondary" size={40} onClick={async () => (await askPermission(), setState(notifyState()))}>{state === 'granted' ? 'Notifications are on' : state === 'denied' ? 'Blocked in your browser' : 'Allow notifications'}</Button>}
    </section>
  )
}

function Appearance() {
  const [prefs, set] = usePrefs()
  return (
    <section id="acc-appearance" className="acc-sec" aria-labelledby="h-app">
      <h2 id="h-app">Appearance</h2>
      <Seg label="Appearance" value={prefs.theme} onChange={(theme) => set({ theme })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      <p className="fine">System follows your device and changes with it.</p>
      {canBuzz() && (
        <p>
          <button className="switch" role="switch" aria-checked={prefs.haptics} aria-label="Haptics" onClick={() => set({ haptics: !prefs.haptics })} /> <span className="fine">A short buzz when an action finishes</span>
        </p>
      )}
    </section>
  )
}

const csv = (v: string) => `"${v.replace(/"/g, '""')}"`
function DataExport({ account }: { account: LocalAccount }) {
  const log = useTxLog()
  const [msg, setMsg] = useState<string>()
  const run = async () => {
    const chain = (await myTrades(account.address)) ?? []
    const seen = new Set(log.map((l) => l.hash))
    const rows = [
      ...log.map((l) => [new Date(l.t).toISOString(), l.kind, l.sentence, l.amountUnits !== undefined ? toDecimal(BigInt(l.amountUnits)) : '', l.status, l.hash ?? '', l.block ?? '']),
      ...chain.filter((x) => !seen.has(x.hash)).map((x) => [new Date(x.t * 1000).toISOString(), x.side, `${x.side === 'buy' ? 'Bought' : 'Sold'} ${x.size} ${x.name}`, toDecimal((x.side === 'buy' ? -1n : 1n) * x.priceCents * 10_000n * x.size), 'Confirmed', x.hash, '']),
    ].sort((a, b) => (a[0] < b[0] ? 1 : -1))
    const text = ['time,type,summary,amount_usd,status,transaction,block', ...rows.map((r) => r.map(csv).join(','))].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' }))
    a.download = 'tivan-activity.csv'
    a.click()
    setMsg(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'}.`)
  }
  return (
    <section id="acc-data" className="acc-sec" aria-labelledby="h-data">
      <h2 id="h-data">Data</h2>
      <p className="fine">Download your activity as a CSV file: what you did in this browser, plus your trades from the chain when the indexer is connected.</p>
      <Button variant="secondary" size={40} onClick={run}>Export activity as CSV</Button>
      {msg && <p className="fine" role="status">{msg}</p>}
    </section>
  )
}
