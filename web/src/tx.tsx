import { createContext, useCallback, useContext, useEffect, useReducer, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Hex, LocalAccount, TransactionReceipt } from 'viem'
import { confirmPasskey } from './account'
import { explorerTx, pub } from './chain'
import { later, Button } from './controls'
import { buzz } from './fx'
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
  const dlg = useRef<HTMLDialogElement>(null)
  const busy = useRef(false)
  const lastHash = useRef<Hex | undefined>(undefined)
  const pending = usePending()

  const show = () => later(() => dlg.current && !dlg.current.open && dlg.current.showModal())
  const open = useCallback((s: TxSpec) => {
    if (busy.current) return
    setSpec(s)
    setNote(undefined)
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
  return (
    <TxContext.Provider value={{ open, pendingCount: pending.length, openPanel }}>
      {children}
      <dialog ref={dlg} className="tx-dialog" aria-labelledby="tx-title" onClick={(e) => e.target === dlg.current && state.phase !== 'confirming' && close()}>
        <div className="tx-head">
          <h2 id="tx-title">{view === 'pending' ? 'Pending transactions' : spec?.title}</h2>
          <button className="ghost line s32" autoFocus onClick={close} disabled={state.phase === 'confirming'}>
            {state.phase === 'done' ? 'Done' : 'Close'}
          </button>
        </div>
        {view === 'pending' ? (
          pending.length ? (
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
          )
        ) : spec ? (
          <>
            {state.phase === 'review' && (
              <>
                {spec.summary.map((s) => (
                  <p key={s} className="tx-sum">
                    {s}
                  </p>
                ))}
                <dl className="tx-rows">
                  {spec.rows.map((r) => (
                    <div key={r.label}>
                      <dt>{r.label}</dt>
                      <dd>
                        {r.value}
                        {r.note && <small>{r.note}</small>}
                      </dd>
                    </div>
                  ))}
                  {spec.total && (
                    <div className="total">
                      <dt>{spec.total.label}</dt>
                      <dd>{spec.total.value}</dd>
                    </div>
                  )}
                </dl>
                {spec.protection && <p className="fine">{spec.protection}</p>}
                <p className="fine">{spec.account.source === 'mera' ? 'Next your device asks for your passkey: fingerprint, face recognition or screen lock. That prompt is your device’s, not ours.' : 'This is a test account stored in this browser, so there is no passkey prompt.'}</p>
                <div className="tx-actions">
                  <Button size={48} onClick={go}>
                    {spec.confirmLabel}
                  </Button>
                  <Button variant="tertiary" size={40} onClick={close}>
                    Cancel
                  </Button>
                </div>
              </>
            )}
            {state.phase !== 'review' && (
              <ol className="tx-steps" aria-live="polite">
                {doneSteps.map((s) => {
                  const sec = stepSeconds(s)
                  return (
                    <li key={s.id} data-status={s.status}>
                      <b>{s.label}</b>
                      <span className="fine">
                        {state.phase === 'confirming' && s.status === 'confirm'
                          ? 'Waiting for your device'
                          : s.status === 'todo'
                            ? 'Waiting'
                            : s.status === 'confirm'
                              ? 'Ready to send'
                              : s.status === 'sent'
                                ? `Sent to Monad at ${clock(s.sentAt!)}. Waiting for confirmation`
                                : s.status === 'confirmed'
                                  ? `Confirmed on Monad in block #${s.block}${sec !== undefined ? ` in ${sec.toFixed(1)} s` : ''} at ${clock(s.confirmedAt!)}`
                                  : 'Did not complete'}
                      </span>
                      {s.hash && <HashLine hash={s.hash} />}
                    </li>
                  )
                })}
              </ol>
            )}
            {state.phase === 'updating' && <p className="fine" role="status">Updating your balance, holdings and order book from chain data.</p>}
            {state.phase === 'done' && (
              <section className="tx-receipt" aria-label="Receipt">
                <p className="tx-sum">{sentenceOf(spec)}</p>
                <dl className="tx-rows">
                  {spec.rows.map((r) => (
                    <div key={r.label}>
                      <dt>{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                  {spec.total && (
                    <div className="total">
                      <dt>{spec.total.label}</dt>
                      <dd>{spec.total.value}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Confirmed</dt>
                    <dd>
                      On Monad, block #{doneSteps.at(-1)?.block}
                      {stepSeconds(doneSteps.at(-1)!) !== undefined ? ` in ${stepSeconds(doneSteps.at(-1)!)!.toFixed(1)} s` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{state.updatedAt ? new Date(state.updatedAt).toLocaleString() : ''}</dd>
                  </div>
                  <div>
                    <dt>Transaction</dt>
                    <dd>{doneSteps.at(-1)?.hash && <HashLine hash={doneSteps.at(-1)!.hash!} />}</dd>
                  </div>
                </dl>
                <p className="fine">
                  Updated from chain data. <a className="u" href="#/activity" onClick={close}>View in Activity</a>
                </p>
              </section>
            )}
            {state.phase === 'failed' && f && (
              <section className={`tx-fail ${f.kind}`} role="alert">
                <p className="tx-sum">{f.message}</p>
                <p className="fine">{f.next}</p>
                <p className="fine">{f.feeSpent === true ? 'A network fee was spent on this attempt.' : f.feeSpent === false ? 'No network fee was spent.' : 'We cannot tell whether a network fee was spent.'}</p>
                {f.newCents !== undefined && <p className="fine">The new price will be shown when you review again.</p>}
                <div className="tx-actions">
                  {f.kind === 'unknown' && f.feeSpent === null ? (
                    <Button variant="secondary" size={40} onClick={checkStatus}>
                      Check status
                    </Button>
                  ) : null}
                  <Button size={40} onClick={() => dispatch({ type: 'back-to-review' })}>
                    Review again
                  </Button>
                </div>
              </section>
            )}
            {note && <p className="fine" role="status">{note}</p>}
          </>
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
