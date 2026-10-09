import { useEffect, useRef, useState, type ReactNode } from 'react'
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
const SECTIONS = [['overview', 'Overview'], ['security', 'Sign-in and security'], ['deposit', 'Deposit address'], ['notifications', 'Notifications'], ['appearance', 'Appearance'], ['data', 'Data and help']] as const

/** A settings section: a titled card of rows. */
function Section({ id, title, sub, children }: { id: string; title: string; sub?: string; children: ReactNode }) {
  return (
    <section id={`acc-${id}`} className="set-card" aria-labelledby={`h-${id}`}>
      <header className="set-head">
        <h2 id={`h-${id}`}>{title}</h2>
        {sub && <p>{sub}</p>}
      </header>
      {children}
    </section>
  )
}
/** One setting: what it is on the left, its value or control on the right. */
function Row({ label, hint, children }: { label: string; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-l">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </div>
      {children !== undefined && <div className="set-r">{children}</div>}
    </div>
  )
}

export function AccountPage({ account, onSignOut }: { account: LocalAccount; onSignOut: () => void }) {
  const [on, setOn] = useState<string>('overview')
  // The highlighted section is the last one whose top has passed the top bar; at the very bottom it is the last one.
  useEffect(() => {
    let raf = 0
    const pick = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const els = SECTIONS.map(([k]) => document.getElementById(`acc-${k}`)).filter(Boolean) as HTMLElement[]
        const line = 140
        let cur = els[0]?.id
        for (const e of els) if (e.getBoundingClientRect().top <= line) cur = e.id
        const doc = document.scrollingElement ?? document.documentElement
        if (doc.scrollTop + innerHeight >= doc.scrollHeight - 4) cur = els[els.length - 1]?.id
        if (cur) setOn(cur.replace('acc-', ''))
      })
    }
    pick()
    addEventListener('scroll', pick, { passive: true, capture: true })
    addEventListener('resize', pick)
    return () => (cancelAnimationFrame(raf), removeEventListener('scroll', pick, { capture: true }), removeEventListener('resize', pick))
  }, [])
  const go = (k: string) => {
    setOn(k)
    document.getElementById(`acc-${k}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <div className="acct-page">
      <nav className="subnav" aria-label="Account sections">
        {SECTIONS.map(([k, l]) => (
          <button key={k} aria-current={on === k ? 'true' : undefined} onClick={() => go(k)}>
            {l}
          </button>
        ))}
        <hr />
        <button onClick={onSignOut}>Sign out</button>
      </nav>
      <div className="acct-col">
        <PageHead title="Account" sub="Your balance, sign-in, deposit address and preferences" />
        <Overview account={account} />
        <Security account={account} onSignOut={onSignOut} />
        <Section id="deposit" title="Deposit address" sub={`Send ${net.mintableQuote ? 'test dollars' : 'USDC'} here from any wallet on ${net.chain.name}. It is your account's own address; we do not hold its key.`}>
          <div className="set-body">
            <DepositAddress account={account} />
          </div>
        </Section>
        <Notifications />
        <Appearance />
        <DataHelp account={account} />
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
  const fig = (x: bigint | undefined) => (x === undefined ? <span className="sk acc-sk" aria-label="Loading" /> : usd(x, 2))
  return (
    <section id="acc-overview" className="set-card acc-hero" aria-labelledby="h-overview">
      <div className="acc-id">
        <span className="acc-avatar" aria-hidden>{account.address.slice(2, 4).toUpperCase()}</span>
        <div className="acc-id-text">
          <h2 id="h-overview">Your account</h2>
          <Copyable value={account.address} label="address" />
          <span className="acc-tags">
            <span>{account.source === 'mera' ? 'Passkey' : 'Test key'}</span>
            <span>{net.chain.name}</span>
          </span>
        </div>
      </div>
      <div className="acc-total">
        <small>Total value</small>
        <b>{fig(v?.total)}</b>
      </div>
      <dl className="acc-break">
        <div><dt>Available cash</dt><dd>{fig(available)}</dd></div>
        <div><dt>In open offers</dt><dd>{fig(reserved)}</dd></div>
        <div><dt>Cards, at the best offer</dt><dd>{fig(v?.cards)}</dd></div>
      </dl>
      {v && v.unmarked > 0 && <p className="fine acc-note">{v.unmarked} card{v.unmarked === 1 ? ' has' : 's have'} no offer yet, so {v.unmarked === 1 ? 'it is' : 'they are'} left out of the total.</p>}
      <div className="acc-actions">
        <Button size={40} onClick={openCash}>Add cash</Button>
        <a className="ghost line s40" href="#/collection">Portfolio</a>
        <a className="ghost line s40" href="#/activity">Activity</a>
      </div>
    </section>
  )
}

function Security({ account, onSignOut }: { account: LocalAccount; onSignOut: () => void }) {
  const pk = savedPasskey()
  const passkey = account.source === 'mera'
  return (
    <Section id="security" title="Sign-in and security" sub="How this device opens your account, and how to take your key with you.">
      <Row label="Sign-in method" hint={passkey ? 'Your fingerprint, face or screen lock. Passkeys sync to your other devices when your password manager syncs them.' : 'A test key kept in this browser. It exists on the test network only.'}>
        <span className="set-val">{passkey ? 'Passkey' : 'Test key'}{passkey && pk?.credentialId ? <small className="mono">{short(pk.credentialId)}</small> : null}</span>
      </Row>
      <Row label="Stay signed in" hint={passkey ? 'This device keeps you signed in for 30 days. Moving cash or cards still asks for your passkey.' : 'This browser keeps you signed in until you sign out.'}>
        <Button variant="secondary" size={40} onClick={onSignOut}>Sign out</Button>
      </Row>
      <KeyExport account={account} />
    </Section>
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
    <>
      <Row label="Private key" hint="Take your account to another wallet. It is a private key, not a recovery phrase: this account has no seed phrase.">
        {phase === 'idle' ? (
          <Button variant="secondary" size={40} onClick={() => (setPhase('warn'), setMsg(undefined))}>Export private key</Button>
        ) : (
          <Button variant="tertiary" size={40} onClick={hide}>Cancel</Button>
        )}
      </Row>
      {(phase !== 'idle' || msg) && (
        <div className="set-body">
          {phase !== 'idle' && (
            <div className="keyexp">
              <ul className="plain risk">
                <li>Anyone who sees this key controls your account and all its cash and cards, with no way to undo it.</li>
                <li>We cannot recover it for you and we never see it. It is never sent to a server or kept in a log.</li>
                <li>Do not screenshot it, paste it into a chat, or type it into any website.</li>
              </ul>
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
            </div>
          )}
          {msg && <p className="fine" role="status">{msg}</p>}
        </div>
      )}
    </>
  )
}

function Notifications() {
  const [state, setState] = useState(notifyState)
  return (
    <Section id="notifications" title="Notifications" sub="Alerts from this browser while Tivan is open in a tab. They are not push notifications.">
      <Row label="Price alerts" hint={canNotify() ? 'Set one on any card page. A closed tab cannot receive them.' : 'This browser does not support notifications.'}>
        {canNotify() && (
          <Button variant="secondary" size={40} disabled={state !== 'default'} onClick={async () => (await askPermission(), setState(notifyState()))}>
            {state === 'granted' ? 'Allowed' : state === 'denied' ? 'Blocked in browser' : 'Allow'}
          </Button>
        )}
      </Row>
      <Row label="Offer filled" hint="Fills show up in Activity."><span className="set-val muted">Not yet available</span></Row>
      <Row label="Deposit received" hint="Deposits show up in Activity."><span className="set-val muted">Not yet available</span></Row>
    </Section>
  )
}

function Appearance() {
  const [prefs, set] = usePrefs()
  return (
    <Section id="appearance" title="Appearance">
      <Row label="Theme" hint="System follows your device and changes with it.">
        <Seg label="Theme" value={prefs.theme} onChange={(theme) => set({ theme })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </Row>
      {canBuzz() && (
        <Row label="Haptics" hint="A short buzz when an action finishes.">
          <button className="switch" role="switch" aria-checked={prefs.haptics} aria-label="Haptics" onClick={() => set({ haptics: !prefs.haptics })} />
        </Row>
      )}
    </Section>
  )
}

const csv = (v: string) => `"${v.replace(/"/g, '""')}"`
function DataHelp({ account }: { account: LocalAccount }) {
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
    <Section id="data" title="Data and help">
      <Row label="Export activity" hint={msg ?? 'A CSV of what you did in this browser, plus your trades from the chain when the indexer is connected.'}>
        <Button variant="secondary" size={40} onClick={run}>Download CSV</Button>
      </Row>
      <Row label="Keyboard shortcuts" hint="Search, navigation and trading without the mouse.">
        <Button variant="secondary" size={40} onClick={openShortcuts}>Show</Button>
      </Row>
      <Row label="Help center" hint="Fees, custody, verification and how trades settle.">
        <a className="ghost line s40" href="#/help">Open</a>
      </Row>
      <Row label="Network" hint={`Chain ID ${net.chain.id}`}><span className="set-val">{net.chain.name}</span></Row>
    </Section>
  )
}
