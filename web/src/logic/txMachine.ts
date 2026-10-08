// The on-chain action lifecycle as one pure state machine, shared by every flow and by the transaction panel.
// review -> confirm with passkey -> sent to Monad -> confirmed in block N -> updated (reconciled from chain) -> receipt.
// Each step carries its own real timestamps; nothing is shown as done before it is.

export type StepStatus = 'todo' | 'confirm' | 'sent' | 'confirmed' | 'failed'

export type TxStep = {
  id: string
  label: string
  status: StepStatus
  hash?: string
  sentAt?: number
  confirmedAt?: number
  block?: bigint
}

export type FailureKind = 'rejected' | 'reverted' | 'price-moved' | 'dropped' | 'unknown'
export type Failure = {
  kind: FailureKind
  /** What happened, in a sentence. */
  message: string
  /** What to do next. */
  next: string
  /** True only when a network fee was certainly spent (the transaction was mined and reverted). null = not known. */
  feeSpent: boolean | null
  newCents?: bigint
}

export type Phase = 'review' | 'confirming' | 'running' | 'updating' | 'done' | 'failed'
export type TxState = {
  phase: Phase
  steps: TxStep[]
  failure?: Failure
  startedAt?: number
  updatedAt?: number
}

export type Action =
  | { type: 'init'; steps: { id: string; label: string }[] }
  | { type: 'confirm'; at: number }
  | { type: 'passkey-ok' }
  | { type: 'sent'; index: number; hash: string; at: number }
  | { type: 'confirmed'; index: number; block: bigint; at: number }
  | { type: 'reconciled'; at: number }
  | { type: 'fail'; failure: Failure; index?: number }
  | { type: 'back-to-review' }

export const initialTx = (steps: { id: string; label: string }[]): TxState => ({ phase: 'review', steps: steps.map((s) => ({ ...s, status: 'todo' })) })

export function txReducer(s: TxState, a: Action): TxState {
  switch (a.type) {
    case 'init':
      return initialTx(a.steps)
    case 'confirm':
      return s.phase === 'review' ? { ...s, phase: 'confirming', startedAt: a.at, steps: s.steps.map((x, i) => (i === 0 ? { ...x, status: 'confirm' } : x)) } : s
    case 'passkey-ok':
      return s.phase === 'confirming' ? { ...s, phase: 'running' } : s
    case 'sent':
      return s.phase === 'running' || s.phase === 'confirming' ? { ...s, phase: 'running', steps: s.steps.map((x, i) => (i === a.index ? { ...x, status: 'sent', hash: a.hash, sentAt: a.at } : x)) } : s
    case 'confirmed': {
      const steps = s.steps.map((x, i) => (i === a.index ? { ...x, status: 'confirmed' as const, block: a.block, confirmedAt: a.at } : x))
      const last = a.index === steps.length - 1
      // The next step waits for its own send; the last confirmation moves to reconciling the app's state from chain data.
      return { ...s, phase: last ? 'updating' : 'running', steps: last ? steps : steps.map((x, i) => (i === a.index + 1 ? { ...x, status: 'confirm' } : x)) }
    }
    case 'reconciled':
      return s.phase === 'updating' ? { ...s, phase: 'done', updatedAt: a.at } : s
    case 'fail':
      return { ...s, phase: 'failed', failure: a.failure, steps: s.steps.map((x, i) => (i === (a.index ?? s.steps.findIndex((y) => y.status !== 'confirmed' && y.status !== 'todo')) ? { ...x, status: 'failed' } : x)) }
    case 'back-to-review':
      // A retry always re-reviews: nothing is resent on its own.
      return s.phase === 'failed' ? { ...initialTx(s.steps.map(({ id, label }) => ({ id, label }))) } : s
  }
}

/** Seconds between send and confirmation for one step, measured from its own timestamps. Undefined until both exist. */
export const stepSeconds = (x: TxStep): number | undefined => (x.sentAt !== undefined && x.confirmedAt !== undefined ? (x.confirmedAt - x.sentAt) / 1000 : undefined)

// ---------------------------------------------------------------- error decoding

const text = (e: unknown): string => {
  const x = e as { shortMessage?: string; message?: string; details?: string; name?: string; cause?: unknown }
  return [x?.name, x?.shortMessage, x?.message, x?.details, x?.cause ? text(x.cause) : ''].filter(Boolean).join(' | ')
}

/** Turn what the passkey library, the wallet, the RPC or the contract threw into one plain-language failure.
 *  `mined` is true when a receipt came back reverted: only then is a network fee certainly spent. */
export function decodeError(e: unknown, o: { mined?: boolean; reviewedCents?: bigint; currentCents?: bigint } = {}): Failure {
  const t = text(e)
  const cause = (e as { cause?: { name?: string } })?.cause
  if (/NotAllowedError|AbortError|cancel|rejected|denied/i.test(t) || cause?.name === 'NotAllowedError')
    return { kind: 'rejected', message: 'You did not confirm, so nothing happened.', next: 'Review again whenever you are ready.', feeSpent: false }
  if (o.currentCents !== undefined && o.reviewedCents !== undefined && o.currentCents !== o.reviewedCents)
    return { kind: 'price-moved', message: 'The price moved before the order was sent, so nothing was charged.', next: 'Review the new price to continue.', feeSpent: false, newCents: o.currentCents }
  if (/insufficient (balance|funds)|exceeds the balance|gas required exceeds/i.test(t))
    return { kind: 'reverted', message: 'Your account does not hold enough MON to pay the network fee.', next: 'Add MON under Add cash, then review again.', feeSpent: false }
  if (/allowance|transfer amount exceeds balance|ERC20/i.test(t))
    return { kind: 'reverted', message: 'The payment was refused: the cash or the allowance was not enough.', next: 'Check your available cash, then review again.', feeSpent: o.mined ?? false }
  if (/fill.?or.?kill|FOK|slippage|min.?amount|too little received|InsufficientLiquidity|not enough liquidity/i.test(t))
    return { kind: 'price-moved', message: 'Someone else took that price first, so the order did not fill.', next: 'Review the current price to try again.', feeSpent: o.mined ?? false }
  if (/replacement transaction|nonce too low|dropped|replaced/i.test(t))
    return { kind: 'dropped', message: 'The transaction was dropped or replaced before it confirmed.', next: 'Review again to send a fresh one.', feeSpent: false }
  if (/timed out|timeout|not found|could not be found/i.test(t))
    return { kind: 'unknown', message: 'We have not seen this transaction confirm yet, so its outcome is unknown.', next: 'Use Check status. Do not send it again until you have.', feeSpent: null }
  if (o.mined) return { kind: 'reverted', message: 'The transaction was mined but the contract refused it.', next: 'Review again. A network fee was spent on this attempt.', feeSpent: true }
  return { kind: 'unknown', message: 'The attempt failed for a reason we could not read.', next: o.mined === false ? 'No network fee was spent. Review again to retry.' : 'Check your activity before trying again.', feeSpent: o.mined === false ? false : null }
}
