import { useMemo, useRef, useState } from 'react'
import { PageHead } from './kit'
import type { LocalAccount } from 'viem'
import { DataTable, Tabs, TableSkeleton, type Col } from './desk'
import { cents, ago, usdC } from './cardParts'
import { later, Button, Chip } from './controls'
import { cancelOrder } from './flows'
import { explorerTx, hasMarket, marketRules, myTrades, type Sku } from './chain'
import { indexerUrl } from './config'
import { formatQty, formatUsd } from './logic/money.ts'
import { centsToUnits } from './logic/money.ts'
import { usePortfolio } from './portfolio'
import { setQuery, useQuery } from './route'
import { Empty, ErrorNote } from './States'
import { HashLine, clock, useTx, useTxLog, type LogEntry } from './tx'
import { cardTitle, parseName, usePoll, useWatch } from './ui'
import { Slab } from './ui'

// One feed of everything the account did on chain, grouped by day. Rows come from this browser's own receipts and, when the
// indexer is connected, from the chain's trades, so activity from another device shows up too.

type Group = 'trades' | 'offers' | 'deposits' | 'withdrawals' | 'vault'
const GROUPS: [Group | 'all', string][] = [['all', 'All'], ['trades', 'Trades'], ['offers', 'Offers'], ['deposits', 'Deposits'], ['withdrawals', 'Withdrawals'], ['vault', 'Vault']]
const groupOf = (k: LogEntry['kind']): Group => (k === 'offer' || k === 'list' || k === 'cancel' ? 'offers' : k === 'deposit' ? 'deposits' : k === 'withdraw' ? 'withdrawals' : k === 'vault' || k === 'redeem' ? 'vault' : 'trades')

type Row = LogEntry & { group: Group; source: 'receipt' | 'chain' }
const day = (t: number) => new Date(t).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

export function Activity({ account }: { account: LocalAccount }) {
  const me = account.address
  const sp = useQuery()
  const tab = (['feed', 'open', 'watch'].includes(sp.get('tab') ?? '') ? sp.get('tab') : 'feed') as 'feed' | 'open' | 'watch'
  const group = (GROUPS.find((g) => g[0] === sp.get('f'))?.[0] ?? 'all') as Group | 'all'
  const log = useTxLog()
  const chain = usePoll(() => myTrades(me), 30000, [me])
  const port = usePortfolio(me, true)
  const watch = useWatch()
  const tx = useTx()
  const [open, setOpen] = useState<Row>()
  const dlg = useRef<HTMLDialogElement>(null)

  const rows: Row[] = useMemo(() => {
    const own: Row[] = log.map((e) => ({ ...e, group: groupOf(e.kind), source: 'receipt' }))
    const seen = new Set(own.map((e) => e.hash))
    const onchain: Row[] = (chain.data ?? [])
      .filter((x) => !seen.has(x.hash))
      .map((x) => {
        const t = x.name.replace(/^(DEMO )?(PSA|BGS|CGC|SGC) (\d+(?:\.5)?) /, '')
        const label = `${t}, ${parseName(x.name).grader} ${parseName(x.name).grade}`
        const total = centsToUnits(x.priceCents) * x.size
        return { id: x.hash, t: x.t * 1000, kind: x.side === 'buy' ? ('buy' as const) : ('sell' as const), title: `${x.side === 'buy' ? 'Bought' : 'Sold'} ${label}`, sentence: `${x.side === 'buy' ? 'Bought' : 'Sold'} ${formatQty(x.size)} ${label} at ${usdC(x.priceCents)}.`, amountUnits: String(x.side === 'buy' ? -total : total), status: 'Confirmed' as const, hash: x.hash, sku: x.sku, group: 'trades' as const, source: 'chain' as const }
      })
    return [...own, ...onchain].sort((a, b) => b.t - a.t)
  }, [log, chain.data])
  const shown = rows.filter((r) => group === 'all' || r.group === group)
  const days = [...new Set(shown.map((r) => day(r.t)))]

  const skus: Sku[] = (port.data?.holdings ?? []).map((h) => h.s)
  const openRows = Object.entries(port.orders ?? {}).flatMap(([id, os]) => {
    const s = skus.find((x) => x.sku === id)
    return s ? os.map((o) => ({ key: `${id}-${o.id}`, s, o: { id: o.id, priceCents: cents(o.price), size: BigInt(o.size), isBuy: o.isBuy } })) : []
  })
  const watched = skus.filter((s) => watch.list.includes(s.sku))
  const cancel = async (r: (typeof openRows)[number]) => {
    if (!port.data || !hasMarket(r.s)) return
    const rules = await marketRules(r.s.market)
    const h = port.data.holdings.find((x) => x.s.sku === r.s.sku)
    tx.open(cancelOrder({ account, s: r.s, label: `${cardTitle(r.s.name)}, ${parseName(r.s.name).grader} ${parseName(r.s.name).grade}`, rules, funds: { ma: port.data.ma, cashRaw: port.data.cashRaw, exCashRaw: port.data.exCashRaw, wallet: h?.wallet ?? 0n, onBook: h?.onBook ?? 0n, gas: port.data.gas }, reconcile: async () => void (await port.refresh()) }, r.o))
  }
  const card = (s: Sku, t: 0 | -1) => (
    <a className="tcard" href={`#/card/${s.sku}`} tabIndex={t}>
      <Slab name={s.name} size="xs" />
      <span><b>{cardTitle(s.name)}</b><small>{parseName(s.name).grader} {parseName(s.name).grade}</small></span>
    </a>
  )
  const openCols: Col<(typeof openRows)[number]>[] = [
    { key: 'card', label: 'Card', cell: (r, t) => card(r.s, t) },
    { key: 'side', label: 'Side', cell: (r) => (r.o.isBuy ? 'Offer' : 'Ask') },
    { key: 'price', label: 'Price', right: true, cell: (r) => usdC(r.o.priceCents) },
    { key: 'n', label: 'Cards', right: true, cell: (r) => formatQty(r.o.size) },
    { key: 'st', label: 'Status', cell: (r) => (r.o.isBuy ? 'Open. Cash is reserved' : 'Open. Waiting for a buyer') },
    { key: 'act', label: 'Actions', right: true, cell: (r, t) => <span className="row-actions"><Button variant="secondary" size={32} tabIndex={t} onClick={() => cancel(r)}>Cancel</Button></span> },
  ]
  const watchCols: Col<Sku>[] = [
    { key: 'card', label: 'Card', cell: (s, t) => card(s, t) },
    { key: 'ask', label: 'Ask', right: true, cell: (s) => (s.ask ? usdC(cents(s.ask)) : 'No ask') },
    { key: 'bid', label: 'Best offer', right: true, cell: (s) => (s.bid ? usdC(cents(s.bid)) : 'No offers') },
    { key: 'last', label: 'Last sale', right: true, cell: (s) => (s.last ? usdC(cents(s.last)) : '—') },
    { key: 'act', label: 'Actions', right: true, cell: (s, t) => <span className="row-actions"><Button variant="tertiary" size={32} tabIndex={t} onClick={() => watch.toggle(s.sku)}>Stop watching</Button></span> },
  ]
  const show = (r: Row) => (setOpen(r), later(() => dlg.current?.showModal()))
  const amount = (r: Row) => (r.amountUnits === undefined ? '' : formatUsd(BigInt(r.amountUnits), { digits: 'auto', sign: 'always' }))

  return (
    <>
      <PageHead title="Activity" sub="Every order, trade and transfer from this account, with its receipt" />
      <Tabs<'feed' | 'open' | 'watch'> label="Activity" value={tab} onChange={(t) => setQuery({ tab: t === 'feed' ? '' : t })} tabs={[['feed', 'Activity', rows.length], ['open', 'Open orders', port.data ? openRows.length : undefined], ['watch', 'Watchlist', port.data ? watched.length : undefined]]} />
      <div className="tabpanel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'feed' && (
          <>
            <div className="chips" role="group" aria-label="Filter activity" style={{ margin: '12px 0 4px' }}>
              {GROUPS.map(([k, l]) => <Chip key={k} selected={group === k} onClick={() => setQuery({ f: k === 'all' ? '' : k })}>{l}</Chip>)}
            </div>
            {!indexerUrl && <p className="fine">Showing what you did in this browser. Trades from other devices need the indexer.</p>}
            {chain.error && <p className="fine">Trades from the chain could not be loaded just now. Showing your own receipts.</p>}
            {shown.length === 0 ? (
              <Empty title={group === 'all' ? 'Nothing here yet' : `No ${GROUPS.find((g) => g[0] === group)![1].toLowerCase()} yet`} detail="Everything you buy, sell, offer, add or move shows up here with its receipt." action={<a className="btn md" href="#/browse">Find a card</a>} />
            ) : (
              days.map((d) => (
                <section key={d} className="feed-day" aria-label={d}>
                  <h2 className="feed-h">{d}</h2>
                  <ul className="feed2">
                    {shown.filter((r) => day(r.t) === d).map((r) => (
                      <li key={r.id + r.source}>
                        <button onClick={() => show(r)}>
                          <span className="fs-main"><b>{r.sentence.replace(/\.$/, '')}</b><small>{clock(r.t)} · {ago(r.t)}</small></span>
                          <span className="fs-amt">{amount(r)}</span>
                          <span className={`fs-status ${r.status.toLowerCase()}`}>{r.status}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}
          </>
        )}
        {tab === 'open' && (port.error && !port.data ? <ErrorNote what="Couldn’t load your orders." why={port.error} next="Try again in a moment." onRetry={port.refresh} /> : !port.data ? <TableSkeleton cols={openCols} rows={3} /> : openRows.length ? <DataTable cols={openCols} rows={openRows} rowKey={(r) => r.key} label="Open orders" /> : <Empty title="No open orders" detail="An offer or a listing waits here until it fills or you cancel it." action={<a className="btn md" href="#/browse">Find a card</a>} />)}
        {tab === 'watch' && (!port.data ? <TableSkeleton cols={watchCols} rows={3} /> : watched.length ? <DataTable cols={watchCols} rows={watched} rowKey={(s) => s.sku} label="Watchlist" onOpen={(s) => (location.hash = `#/card/${s.sku}`)} /> : <Empty title="Nothing on your watchlist" detail="Use Watch on a card and it appears here." action={<a className="btn md" href="#/browse">Find a card</a>} />)}
      </div>
      <dialog ref={dlg} className="tx-dialog" aria-labelledby="rc-title" onClick={(e) => e.target === dlg.current && dlg.current?.close()}>
        {open && (
          <>
            <div className="tx-head"><h2 id="rc-title">Receipt</h2><button className="ghost line s32" autoFocus onClick={() => dlg.current?.close()}>Close</button></div>
            <p className="tx-sum">{open.sentence}</p>
            <dl className="tx-rows">
              <div><dt>Status</dt><dd>{open.status}</dd></div>
              {open.amountUnits !== undefined && <div><dt>Amount</dt><dd>{amount(open)}</dd></div>}
              <div><dt>Time</dt><dd>{new Date(open.t).toLocaleString()}</dd></div>
              {open.block && <div><dt>Confirmed</dt><dd>On Monad, block #{open.block}{open.seconds !== undefined ? ` in ${open.seconds.toFixed(1)} s` : ''}</dd></div>}
              {open.hash && <div><dt>Transaction</dt><dd><HashLine hash={open.hash} /></dd></div>}
              {open.source === 'chain' && <div><dt>Source</dt><dd>Read from the chain, not from this browser</dd></div>}
            </dl>
            {open.status === 'Failed' && <p className="fine">{open.feeSpent === true ? 'A network fee was spent on this attempt.' : open.feeSpent === false ? 'No network fee was spent.' : 'We cannot tell whether a network fee was spent.'}</p>}
            {open.hash && <p className="fine"><a className="u" href={explorerTx(open.hash)} target="_blank" rel="noreferrer">Open on the explorer</a>{open.sku && <> · <a className="u" href={`#/card/${open.sku}`} onClick={() => dlg.current?.close()}>Open the card</a></>}</p>}
          </>
        )}
      </dialog>
    </>
  )
}
