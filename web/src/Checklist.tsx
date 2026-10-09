import { useState } from 'react'
import type { LocalAccount } from 'viem'
import { openCash, reservedUnits } from './Cash'
import { usePortfolio } from './portfolio'
import { useTxLog } from './tx'

// "Get started": four steps that tick from real state, link into each flow, never block, and can be dismissed (and brought back).
const DISMISS = 'tivan.checklist.off'
const alertCount = () => {
  try {
    return (JSON.parse(localStorage.getItem('tivan.alerts') ?? '[]') as unknown[]).length
  } catch {
    return 0
  }
}

export function Checklist({ account }: { account: LocalAccount }) {
  const { data, orders } = usePortfolio(account.address, true)
  const log = useTxLog()
  const [off, setOff] = useState(() => localStorage.getItem(DISMISS) === '1')
  const set = (v: boolean) => {
    try {
      v ? localStorage.setItem(DISMISS, '1') : localStorage.removeItem(DISMISS)
    } catch {}
    setOff(v)
  }
  const has = (...k: string[]) => log.some((e) => k.includes(e.kind) && e.status === 'Confirmed')
  const holds = (data?.holdings ?? []).some((h) => h.count > 0)
  const open = Object.values(orders ?? {}).some((o) => o.length > 0)
  const cash = data ? data.cashRaw + data.exCashRaw > 0n || (orders ? reservedUnits(orders) > 0n : false) : false
  const items: { done: boolean; label: string; act: React.ReactNode }[] = [
    { done: cash || has('deposit'), label: 'Add cash', act: <button className="mini" onClick={openCash}>Add</button> },
    { done: holds || open || has('buy', 'offer', 'list'), label: 'Make your first offer or buy', act: <a className="mini" href="#/browse">Browse</a> },
    { done: has('vault'), label: 'Vault a card', act: <a className="mini" href="#/vault">Vault</a> },
    { done: alertCount() > 0, label: 'Turn on a price alert', act: <a className="mini" href="#/browse">Pick</a> },
  ]
  const done = items.filter((i) => i.done).length
  if (off)
    return (
      <p className="fine">
        Get started is hidden. <button className="linkbtn" onClick={() => set(false)}>Show it again</button>
      </p>
    )
  return (
    <section className="pnl checklist2" aria-label="Get started">
      <header className="pnl-h">
        <h2>Get started</h2>
        <span className="pnl-meta">{done} of {items.length}</span>
      </header>
      <span className="ck-bar" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done} aria-label="Steps done"><i style={{ width: `${(done / items.length) * 100}%` }} /></span>
      <ol className="ck-list">
        {items.map((i, n) => (
          <li key={i.label} data-done={i.done}>
            <span className="ck-num" aria-hidden>{i.done ? '✓' : n + 1}</span>
            <span className="ck-text">
              {i.label}
              <span className="sr">{i.done ? ', done' : ', not done yet'}</span>
            </span>
            {!i.done && i.act}
          </li>
        ))}
      </ol>
      <button className="linkbtn quiet" onClick={() => set(true)}>Hide this list</button>
    </section>
  )
}
