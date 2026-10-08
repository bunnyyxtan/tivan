import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Hex, LocalAccount, TransactionReceipt } from 'viem'
import { confirmPasskey } from './account'
import { ensureGas } from './attestor'
import { explorerTx, pub } from './chain'
import { later, Button } from './controls'
import { buzz } from './fx'
import { confetti, earn, type Badge } from './celebrate'
import { IconCheck, IconClose } from './icons'
import { Slab } from './ui'
import { decodeError, initialTx, stepSeconds, txReducer, type Failure } from './logic/txMachine.ts'

// One shared lifecycle and one shared panel for every on-chain action (approve, buy, offer, sell, cancel, deposit, withdraw, vault).
// Review -> confirm with the passkey -> sent to Monad -> confirmed in block N -> updated from chain data -> receipt.

export type ReviewRow = { label: string; value: string; note?: string }
export type StepSpec = {
  id: string
  label: string
  run: (hooks: { onSent: (hash: Hex, at: number) => void }) => Promise<TransactionReceipt>
}
export type TxKind = 'buy' | 'offer' | 'sell' | 'list' | 'cancel' | 'deposit' | 'withdraw' | 'vault' | 'redeem' | 'approve'
export type TxSpec = {
  kind: TxKind
  account: LocalAccount
  title: string
  /** What happens, in plain words: what you pay, what you get. */
  summary: string[]
  rows: ReviewRow[]
  total?: ReviewRow
  protection?: string
  confirmLabel: string
  steps: StepSpec[]
  /** Re-read the price just before sending; a market order whose price moved is stopped and re-reviewed. */
  precheck?: () => Promise<{ reviewedCents: bigint; currentCents: bigint } | void>
  /** Re-read balances, holdings, the book and activity from chain data. The flow is not done until this finishes. */
  reconcile: () => Promise<void>
  /** The one-sentence receipt. A function is read when the action finishes, for facts only known then (a certificate number). */
  receiptSentence: string | (() => string)
  amountUnits?: bigint
  sku?: string
  /** The card being traded, drawn as a slab at the top of the panel. */
  art?: string
}

// ---------------------------------------------------------------- what the user did, kept in this browser
export type LogEntry = {
  id: string
  t: number
  kind: TxKind
  title: string
  sentence: string
  amountUnits?: string
  status: 'Pending' | 'Confirmed' | 'Failed'
  hash?: string
  block?: string
  seconds?: number
  feeSpent?: boolean | null
  failure?: string
  sku?: string
}
const LOG = 'tivan.txlog.v1'
const PEND = 'tivan.txpending.v1'
const EVT = 'tivan-txlog'
const parse = <T,>(raw: string | null): T[] => {
  try {
    return JSON.parse(raw ?? '[]')
  } catch {
    return []
  }
}
const subscribe = (cb: () => void) => (addEventListener(EVT, cb), addEventListener('storage', cb), () => (removeEventListener(EVT, cb), removeEventListener('storage', cb)))
export function writeLog(fn: (l: LogEntry[]) => LogEntry[]) {
  try {
    localStorage.setItem(LOG, JSON.stringify(fn(parse<LogEntry>(localStorage.getItem(LOG))).slice(0, 200)))
  } catch {}
  dispatchEvent(new Event(EVT))
}
export const useTxLog = (): LogEntry[] => parse<LogEntry>(useSyncExternalStore(subscribe, () => localStorage.getItem(LOG) ?? '[]'))

type Pending = { id: string; hash: Hex; title: string; sentAt: number }
const writePending = (fn: (p: Pending[]) => Pending[]) => {
  try {
    localStorage.setItem(PEND, JSON.stringify(fn(parse<Pending>(localStorage.getItem(PEND)))))
  } catch {}
  dispatchEvent(new Event(EVT))
}
const usePending = (): Pending[] => parse<Pending>(useSyncExternalStore(subscribe, () => localStorage.getItem(PEND) ?? '[]'))

// ---------------------------------------------------------------- small pieces
const sentenceOf = (s: TxSpec) => (typeof s.receiptSentence === 'function' ? s.receiptSentence() : s.receiptSentence)
export const clock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: 'numeric' })
const shortHash = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`
/** A transaction hash in monospace, with a copy control and an explorer link. */
export function HashLine({ hash }: { hash: string }) {
  const [done, setDone] = useState(false)
  return (
    <span className="hashline">
      <span className="mono">{shortHash(hash)}</span>
      <button
        type="button"
        className="ghost s32"
        aria-label="Copy transaction hash"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(hash)
            setDone(true)
            setTimeout(() => setDone(false), 1800)
          } catch {}
        }}
      >
        {done ? 'Copied' : 'Copy'}
      </button>
      <a className="u" href={explorerTx(hash)} target="_blank" rel="noreferrer">
        Explorer
      </a>
    </span>
  )
}

// ---------------------------------------------------------------- provider and panel
type Ctx = { open: (spec: TxSpec) => void; pendingCount: number; openPanel: () => void }
const TxContext = createContext<Ctx>({ open: () => {}, pendingCount: 0, openPanel: () => {} })
export const useTx = () => useContext(TxContext)

export function TxProvider({ children }: { children: ReactNode }) {
  const [spec, setSpec] = useState<TxSpec>()
  const [state, dispatch] = useReducer(txReducer, initialTx([]))
  const [view, setView] = useState<'action' | 'pending'>('action')
  const [note, setNote] = useState<string>()
  const [badges, setBadges] = useState<Badge[]>([])
  const [now, setNow] = useState(Date.now())
  const dlg = useRef<HTMLDialogElement>(null)
  const busy = useRef(false)
  const lastHash = useRef<Hex | undefined>(undefined)
  const pending = usePending()

  const show = () => later(() => dlg.current && !dlg.current.open && dlg.current.showModal())
  const open = useCallback((s: TxSpec) => {
    if (busy.current) return
    setSpec(s)
    setNote(undefined)
    setBadges([])
    setView('action')
    dispatch({ type: 'init', steps: s.steps.map(({ id, label }) => ({ id, label })) })
    show()
  }, [])
  const openPanel = useCallback(() => {
    setView(busy.current ? 'action' : 'pending')
    show()
  }, [])

  // Resolve transactions that were sent before a refresh: look for their receipts and log what we find.
  useEffect(() => {
    const poll = async () => {
      for (const p of parse<Pending>(localStorage.getItem(PEND))) {
        if (busy.current) return
        const r = await pub.getTransactionReceipt({ hash: p.hash }).catch(() => undefined)
        if (!r) continue
        writePending((l) => l.filter((x) => x.hash !== p.hash))
        writeLog((l) => [{ id: p.id, t: Date.now(), kind: 'approve', title: p.title, sentence: `${p.title}: ${r.status === 'success' ? 'confirmed' : 'reverted'} in block #${r.blockNumber}.`, status: r.status === 'success' ? 'Confirmed' : 'Failed', hash: p.hash, block: String(r.blockNumber) }, ...l.filter((x) => x.id !== p.id)])
      }
    }
    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [])

  const fail = (f: Failure, index?: number) => dispatch({ type: 'fail', failure: f, index })

  const go = async () => {
    if (!spec || busy.current) return
    busy.current = true
    const id = `${spec.kind}-${Date.now()}`
    const reviewed = spec
    try {
      dispatch({ type: 'confirm', at: Date.now() })
      try {
        // The passkey prompt is the device's own; the review text explained it first.
        if (reviewed.account.source === 'mera') await confirmPasskey(reviewed.account.address)
        dispatch({ type: 'passkey-ok' })
        // On the test network, network fees are topped up from the faucet first, so nobody stalls for want of MON.
        setNote('Checking your network fee balance.')
        if (!(await ensureGas(reviewed.account.address, reviewed.steps.length))) setNote('The test faucet could not top up your MON just now. The network may refuse the fee.')
        else setNote(undefined)
        const pre = await reviewed.precheck?.()
        if (pre && pre.reviewedCents !== pre.currentCents) return void fail(decodeError(new Error('price moved'), pre))
      } catch (e) {
        return void fail(decodeError(e))
      }
      let last: { hash: Hex; block: bigint; seconds?: number } | undefined
      for (let i = 0; i < reviewed.steps.length; i++) {
        let hash: Hex | undefined
        let sentAt = 0
        try {
          const r = await reviewed.steps[i].run({
            onSent: (h, at) => {
              hash = h
              sentAt = at
              lastHash.current = h
              dispatch({ type: 'sent', index: i, hash: h, at })
              writePending((p) => [...p, { id, hash: h, title: reviewed.title, sentAt: at }])
            },
          })
          const at = Date.now()
          dispatch({ type: 'confirmed', index: i, block: r.blockNumber, at })
          writePending((p) => p.filter((x) => x.hash !== hash))
          last = { hash: r.transactionHash, block: r.blockNumber, seconds: sentAt ? (at - sentAt) / 1000 : undefined }
        } catch (e) {
          const f = decodeError(e, { mined: (e as { mined?: boolean }).mined })
          if (f.kind !== 'unknown' || f.feeSpent !== null) writePending((p) => p.filter((x) => x.hash !== hash))
          writeLog((l) => [{ id, t: Date.now(), kind: reviewed.kind, title: reviewed.title, sentence: `${reviewed.title}: ${f.message}`, status: 'Failed', hash, feeSpent: f.feeSpent, failure: f.kind, sku: reviewed.sku }, ...l])
          return void fail(f, i)
        }
      }
      try {
        await reviewed.reconcile()
      } catch {
        setNote('We could not refresh your balances just now. They update on the next check.')
      }
      dispatch({ type: 'reconciled', at: Date.now() })
      buzz()
      confetti()
      setBadges(earn(reviewed.kind, last?.seconds))
      writeLog((l) => [{ id, t: Date.now(), kind: reviewed.kind, title: reviewed.title, sentence: sentenceOf(reviewed), amountUnits: reviewed.amountUnits?.toString(), status: 'Confirmed', hash: last?.hash, block: last && String(last.block), seconds: last?.seconds, feeSpent: true, sku: reviewed.sku }, ...l])
    } finally {
      busy.current = false
    }
  }

  const checkStatus = async () => {
    if (!lastHash.current) return setNote('There is no transaction hash to check yet. Nothing was sent.')
    const r = await pub.getTransactionReceipt({ hash: lastHash.current }).catch(() => undefined)
    setNote(!r ? 'Still not seen on Monad. It may yet confirm. Check again in a moment, and do not send it again until you have.' : r.status === 'success' ? `It confirmed in block #${r.blockNumber}. Your activity shows it; review before sending anything further.` : `It was mined and reverted in block #${r.blockNumber}. A network fee was spent.`)
  }

  const close = () => dlg.current?.close()
  const f = state.failure
  const doneSteps = state.steps
  const live = state.phase === 'confirming' || state.phase === 'running' || state.phase === 'updating'
  // A ticking clock while the action is in flight, so the wait is visible and short.
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [live])
  const started = doneSteps.find((x) => x.sentAt)?.sentAt
  const lastStep = doneSteps.at(-1)
  const secs = lastStep ? stepSeconds(lastStep) : undefined
  const headline: Record<TxKind, string> = { buy: 'It’s yours', offer: 'Offer placed', sell: 'Sold', list: 'Listed for sale', cancel: 'Order cancelled', deposit: 'Cash added', withdraw: 'Sent', vault: 'Checked in', redeem: 'Request recorded', approve: 'Approved' }
  const verb: Record<TxKind, string> = { buy: 'Buy', offer: 'Offer', sell: 'Sell', list: 'List', cancel: 'Cancel', deposit: 'Cash', withdraw: 'Withdraw', vault: 'Vault', redeem: 'Redeem', approve: 'Approve' }
  return (
    <TxContext.Provider value={{ open, pendingCount: pending.length, openPanel }}>
      {children}
      <dialog ref={dlg} className={`trade ${state.phase}`} aria-labelledby="tx-title" onClick={(e) => e.target === dlg.current && !live && close()}>
        <header className="trade-top">
          <span className="eyebrow">{view === 'pending' ? 'Pending' : spec ? verb[spec.kind] : ''}</span>
          <button className="icon-btn trade-x" autoFocus onClick={close} disabled={state.phase === 'confirming'} aria-label={state.phase === 'done' ? 'Done' : 'Close'}><IconClose /></button>
        </header>
        {view === 'pending' ? (
          <div className="trade-body">
            <h2 id="tx-title" className="trade-h">Pending transactions</h2>
            {pending.length ? (
              <ul className="tx-list">
                {pending.map((p) => (
                  <li key={p.hash}>
                    <b>{p.title}</b>
                    <span className="fine">Sent at {clock(p.sentAt)}. Waiting for confirmation.</span>
                    <HashLine hash={p.hash} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fine">Nothing is pending. Recent activity is on the Activity page.</p>
            )}
          </div>
        ) : spec ? (
          <div className="trade-body">
            {state.phase !== 'done' && (
              <div className="trade-hero">
                {spec.art ? <span className="trade-art"><Slab name={spec.art} size="sm" /></span> : null}
                <div className="trade-hero-text">
                  <h2 id="tx-title" className="trade-h">{spec.title}</h2>
                  {spec.total && (
                    <p className="trade-total">
                      <small>{spec.total.label}</small>
                      <b>{spec.total.value}</b>
                    </p>
                  )}
                </div>
              </div>
            )}

            {state.phase === 'review' && (
              <>
                {spec.summary.map((x) => <p key={x} className="trade-sum">{x}</p>)}
                <dl className="trade-rows">
                  {spec.rows.map((r) => (
                    <div key={r.label}>
                      <dt>{r.label}</dt>
                      <dd>{r.value}{r.note && <small>{r.note}</small>}</dd>
                    </div>
                  ))}
                </dl>
                {spec.protection && <p className="trade-note"><IconCheck />{spec.protection}</p>}
                <Button size={48} onClick={go}>{spec.confirmLabel}</Button>
                <p className="fine trade-fine">{spec.account.source === 'mera' ? 'Next, your device asks for your passkey. That prompt is your device’s, not ours.' : 'Test account in this browser: no passkey prompt.'} Nothing is sent until you confirm.</p>
              </>
            )}

            {(live || state.phase === 'failed') && (
              <>
                <div className="trade-clock" aria-hidden={!live}>
                  <span className="trade-ring" />
                  <b>{state.phase === 'failed' ? 'Not completed' : started ? `${((now - started) / 1000).toFixed(1)} s` : state.phase === 'confirming' ? 'Confirm' : 'Preparing'}</b>
                  <small>{state.phase === 'confirming' ? 'Waiting for your confirmation' : state.phase === 'updating' ? 'Updating your balances' : state.phase === 'failed' ? (f?.feeSpent === false ? 'Nothing left your account' : 'See below for what happened') : started ? 'Settling on Monad' : 'Checking your balance and the price'}</small>
                </div>
                <ol className="trade-steps" aria-live="polite">
                  {doneSteps.map((x) => {
                    const sec = stepSeconds(x)
                    return (
                      <li key={x.id} data-status={x.status}>
                        <span className="ts-dot" aria-hidden>{x.status === 'confirmed' ? <IconCheck /> : null}</span>
                        <span className="ts-text">
                          <b>{x.label}</b>
                          <small>
                            {state.phase === 'confirming' && x.status === 'confirm' ? 'Waiting for your device' : x.status === 'todo' ? 'Next' : x.status === 'confirm' ? 'Ready' : x.status === 'sent' ? 'Sent to Monad, confirming' : x.status === 'confirmed' ? `Block #${x.block}${sec !== undefined ? ` · ${sec.toFixed(1)} s` : ''}` : 'Did not complete'}
                          </small>
                        </span>
                        {x.hash && <a className="ts-link" href={explorerTx(x.hash)} target="_blank" rel="noreferrer">View</a>}
                      </li>
                    )
                  })}
                </ol>
              </>
            )}

            {state.phase === 'done' && (
              <section className="trade-done" aria-label="Done">
                <span className="done-check" aria-hidden>
                  <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-15" /></svg>
                </span>
                {spec.art && <span className="done-art"><Slab name={spec.art} size="md" /></span>}
                <h2 id="tx-title" className="done-h">{headline[spec.kind]}</h2>
                <p className="done-sum">{sentenceOf(spec)}</p>
                <div className="done-chips">
                  {secs !== undefined && <span className="done-chip"><b>{secs.toFixed(1)} s</b> to settle</span>}
                  {lastStep?.block !== undefined && <span className="done-chip">Block <b>#{String(lastStep.block)}</b></span>}
                  {spec.total && <span className="done-chip">{spec.total.label} <b>{spec.total.value}</b></span>}
                </div>
                {badges.map((b) => (
                  <div key={b.id} className="badge-card" role="status">
                    <span className="badge-medal" aria-hidden>{b.title.slice(0, 1)}</span>
                    <span><small>Badge unlocked</small><b>{b.title}</b><span>{b.text}</span></span>
                  </div>
                ))}
                <div className="done-actions">
                  {spec.sku ? <a className="btn lg" href="#/collection" onClick={close}>View portfolio</a> : <a className="btn lg" href="#/" onClick={close}>Find a card</a>}
                  <Button variant="secondary" size={48} onClick={close}>Done</Button>
                </div>
                <details className="done-receipt">
                  <summary>Receipt</summary>
                  <dl className="trade-rows">
                    {spec.rows.map((r) => (
                      <div key={r.label}><dt>{r.label}</dt><dd>{r.value}</dd></div>
                    ))}
                    <div><dt>Time</dt><dd>{state.updatedAt ? new Date(state.updatedAt).toLocaleString() : ''}</dd></div>
                    {lastStep?.hash && <div><dt>Transaction</dt><dd><HashLine hash={lastStep.hash} /></dd></div>}
                  </dl>
                  <p className="fine">Updated from chain data. <a className="u" href="#/activity" onClick={close}>View in Activity</a></p>
                </details>
              </section>
            )}

            {state.phase === 'failed' && f && (
              <section className={`trade-fail ${f.kind}`} role="alert">
                <b>{f.message}</b>
                <p className="fine">{f.next}</p>
                <p className="fine">{f.feeSpent === true ? 'A network fee was spent on this attempt.' : f.feeSpent === false ? 'No network fee was spent.' : 'We cannot tell whether a network fee was spent.'}</p>
                {f.newCents !== undefined && <p className="fine">The new price will be shown when you review again.</p>}
                <div className="done-actions">
                  <Button size={48} onClick={() => dispatch({ type: 'back-to-review' })}>Review again</Button>
                  {f.kind === 'unknown' && f.feeSpent === null ? <Button variant="secondary" size={48} onClick={checkStatus}>Check status</Button> : null}
                </div>
              </section>
            )}
            {note && <p className="fine trade-fine" role="status">{note}</p>}
          </div>
        ) : null}
      </dialog>
    </TxContext.Provider>
  )
}

/** The header chip: text and a count, never a dot. */
export function TxChip() {
  const { pendingCount, openPanel } = useTx()
  if (!pendingCount) return null
  return (
    <button className="chip-b" onClick={openPanel}>
      {pendingCount} transaction{pendingCount === 1 ? '' : 's'} pending
    </button>
  )
}
