import { useEffect, useRef, useState } from 'react'
import { getAddress, isAddress, parseUnits, type LocalAccount } from 'viem'
import { later, Button, Copyable, Opt, useOnClose } from './controls'
import { erc20Abi, explorerAddress, marginAbi, pub, sendTx } from './chain'
import { net } from './config'
import { centsToUnits, formatUsd, parseAmount, toDecimal } from './logic/money.ts'
import { usePortfolio } from './portfolio'
import { cents } from './cardParts'
import { useTx, useTxLog, writeLog, type StepSpec, type TxSpec } from './tx'
import { usePoll } from './ui'
import { drip } from './attestor'
import { IconClose } from './icons'

export const openCash = () => dispatchEvent(new Event('tivan-cash'))
/** Goes straight to the review for $10,000 of test dollars (testnet), the shortest path to a first transaction. */
export const addTestDollars = () => dispatchEvent(new CustomEvent('tivan-cash', { detail: 'mint' }))
const usd = (u: bigint, digits: 'auto' | 2 = 'auto') => formatUsd(u, { digits })
const mon = (wei: bigint) => `${(Number(wei) / 1e18).toFixed(3)} MON`
const KNOWN = 'tivan.withdrawTo'
const known = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KNOWN) ?? '[]')
  } catch {
    return []
  }
}

/** Reserved cash is what open offers hold: price x size of every resting bid. */
export function reservedUnits(orders?: Record<string, { price: number; size: number; isBuy: boolean }[]>): bigint {
  return Object.values(orders ?? {}).flat().filter((o) => o.isBuy).reduce((n, o) => n + centsToUnits(cents(o.price)) * BigInt(o.size), 0n)
}

/** The header's balance: available cash and Add. It opens the cash sheet. */
export function BalancePill({ account }: { account: LocalAccount }) {
  const { data } = usePortfolio(account.address)
  const available = data ? data.cashRaw + data.exCashRaw : undefined
  return (
    <button className="cash-pill" data-tour="cash" onClick={openCash} aria-label={`${available === undefined ? 'Checking balance' : `${usd(available, 2)} available`}. Add cash`}>
      {available === undefined ? '…' : usd(available)}
      <span>Add</span>
    </button>
  )
}

function Qr({ value }: { value: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let live = true
    import('qrcode').then((m) => m.toDataURL(value, { margin: 1, width: 176, color: { dark: '#14111f', light: '#ffffff' } })).then((u) => live && setSrc(u), () => {})
    return () => void (live = false)
  }, [value])
  return src ? <img className="qr" src={src} width={176} height={176} alt="QR code for your deposit address" /> : <span className="qr qr-wait" aria-hidden />
}

/** The account's own address: copy, QR code, the network named plainly, and a watcher that shows a deposit when it confirms. */
export function DepositAddress({ account }: { account: LocalAccount }) {
  const me = account.address
  const base = useRef<bigint | undefined>(undefined)
  const [got, setGot] = useState<bigint>()
  usePoll(
    async () => {
      const b = await pub.readContract({ address: net.quote, abi: erc20Abi, functionName: 'balanceOf', args: [me] })
      if (base.current === undefined) base.current = b
      else if (b > base.current) {
        const diff = b - base.current
        base.current = b
        setGot(diff)
        writeLog((l) => [{ id: `dep-${Date.now()}`, t: Date.now(), kind: 'deposit', title: 'Deposit', sentence: `Received ${usd(diff, 2)} ${net.quoteSymbol === 'USD' ? 'USDC' : net.quoteSymbol} from another wallet.`, amountUnits: diff.toString(), status: 'Confirmed', feeSpent: false }, ...l])
      }
      return b
    },
    4000,
    [me],
  )
  return (
    <div className="deposit">
      <div className="deposit-row">
        <Qr value={me} />
        <div className="deposit-text">
          <p className="fine">Your address on {net.chain.name} (chain ID {net.chain.id}). It is yours alone, made on this device.</p>
          <Copyable value={me} label="deposit address" />
          <p className="warn-line">Send only {net.mintableQuote ? 'the test dollar token' : 'USDC'} on {net.chain.name}. Anything else sent here, or sent on another network, can be lost.</p>
        </div>
      </div>
      <p className="fine" role="status">
        {got !== undefined ? `Deposit confirmed: ${usd(got, 2)} arrived.` : 'Waiting for a deposit. We check every few seconds, and a transfer shows here once it is confirmed on Monad. Unconfirmed transfers are not visible to us.'}
      </p>
      <p className="fine"><a className="u" href={explorerAddress(me)} target="_blank" rel="noreferrer">View your address on the explorer</a></p>
    </div>
  )
}

type CashTab = 'test' | 'deposit' | 'withdraw' | 'fees'

export function CashSheet({ account }: { account: LocalAccount }) {
  const dlg = useRef<HTMLDialogElement>(null)
  const [openIt, setOpenIt] = useState(false)
  const tabs: [CashTab, string][] = [...(net.mintableQuote ? [['test', 'Test dollars'] as [CashTab, string]] : []), ['deposit', 'Deposit'], ['withdraw', 'Withdraw'], ['fees', 'Network fees']]
  const [tab, setTab] = useState<CashTab>(tabs[0][0])
  const tx = useTx()
  const p = usePortfolio(account.address, true)
  const d = p.data
  const available = d ? d.cashRaw + d.exCashRaw : undefined
  const reserved = p.orders ? reservedUnits(p.orders) : undefined
  const [monMsg, setMonMsg] = useState<string>()
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const h = (e: Event) => ((e as CustomEvent).detail === 'mint' && net.mintableQuote ? mintRef.current() : (setOpenIt(true), later(() => dlg.current && !dlg.current.open && dlg.current.showModal())))
    addEventListener('tivan-cash', h)
    return () => removeEventListener('tivan-cash', h)
  }, [])
  const close = () => dlg.current?.close()
  useOnClose(dlg, () => setOpenIt(false))

  const mint = () => {
    const units = parseUnits('10000', net.quoteDecimals)
    const spec: TxSpec = {
      kind: 'deposit',
      account,
      title: 'Add test dollars',
      summary: ['You receive 10,000 test dollars. They are free, have no value, and exist only on this test network.'],
      rows: [{ label: 'You receive', value: usd(units) }, { label: 'Platform fee', value: '$0', note: 'No fee on test dollars' }, { label: 'Network fee', value: 'about 0.02 MON', note: 'An estimate, paid in MON. Topped up from the test faucet first if you are short.' }],
      total: { label: 'You receive', value: usd(units) },
      confirmLabel: 'Add $10,000',
      steps: [{ id: 'mint', label: 'Mint 10,000 test dollars', run: (h) => sendTx(account, { address: net.quote, abi: erc20Abi, functionName: 'mint', args: [account.address, units] }, h) }],
      reconcile: async () => void (await p.refresh()),
      receiptSentence: `Added ${usd(units)} of test dollars to your account.`,
      amountUnits: units,
    }
    close()
    tx.open(spec)
  }
  const mintRef = useRef(mint)
  mintRef.current = mint
  const getMon = async () => {
    setBusy(true)
    setMonMsg(undefined)
    try {
      const r = await drip(account.address)
      if (r.txHash) {
        setMonMsg('Test MON is on its way.')
        await pub.waitForTransactionReceipt({ hash: r.txHash as `0x${string}`, timeout: 30_000 }).catch(() => {})
        await p.refresh()
        setMonMsg('Test MON arrived. You can pay network fees now.')
      } else setMonMsg('The faucet answered, but sent nothing.')
    } catch (e) {
      const m = (e as Error).message
      setMonMsg(/10 minutes/.test(m) ? 'You already topped up in the last 10 minutes. Try again shortly.' : /still has enough/.test(m) ? 'This address still has enough MON for network fees.' : /busy|low/.test(m) ? 'The test faucet is busy or low right now. Try again later, or use faucet.monad.xyz.' : 'The faucet could not be reached. Try again in a moment.')
    }
    setBusy(false)
  }
  return (
    <dialog ref={dlg} className="cash-modal" aria-labelledby="cash-title" onClick={(e) => e.target === dlg.current && close()}>
      {openIt && (
        <>
          <header className="cash-top">
            <div>
              <h2 id="cash-title">Cash</h2>
              <p className="fine">{net.mintableQuote ? 'Test dollars' : 'USDC'} on {net.chain.name}. Every price and order settles in it.</p>
            </div>
            <button className="icon-btn" autoFocus onClick={close} aria-label="Close"><IconClose /></button>
          </header>
          <section className="cash-sum" aria-label="Your cash">
            <div className="cash-main">
              <span className="lbl-caps">Available to trade</span>
              <b className="cash-big">{available === undefined ? '…' : usd(available, 2)}</b>
            </div>
            <dl className="cash-figs">
              <div><dt>Reserved in offers</dt><dd>{reserved === undefined ? '…' : usd(reserved, 2)}</dd></div>
              <div><dt>Total</dt><dd>{available === undefined || reserved === undefined ? '…' : usd(available + reserved, 2)}</dd></div>
              <div><dt>Network fee balance</dt><dd>{d ? mon(d.gas) : '…'}</dd></div>
            </dl>
          </section>
          <div className="pills cash-tabs" role="tablist" aria-label="Cash actions">
            {tabs.map(([k, l]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
          <div className="cash-body" role="tabpanel">
            {tab === 'test' && (
              <div className="cash-offer">
                <div>
                  <span className="lbl-caps">Free on the test network</span>
                  <b className="cash-big sm">$10,000</b>
                  <p className="fine">Test dollars have no value and exist only on {net.chain.name}. Add them as often as you like. If you are short of MON for the network fee, it is topped up from the test faucet first.</p>
                </div>
                <Button size={48} onClick={mint}>Add $10,000 test dollars</Button>
              </div>
            )}
            {tab === 'deposit' && (
              <>
                <p className="fine">Send {net.mintableQuote ? 'test dollars' : 'USDC'} from any wallet on {net.chain.name} to your own address. Card and bank deposits are not offered: no payment provider is connected.</p>
                <DepositAddress account={account} />
              </>
            )}
            {tab === 'withdraw' && <Withdraw account={account} onDone={close} />}
            {tab === 'fees' && (
              <div className="cash-offer">
                <div>
                  <span className="lbl-caps">Paid in MON, not dollars</span>
                  <b className="cash-big sm">{d ? mon(d.gas) : '…'}</b>
                  <p className="fine">
                    {net.name === 'testnet'
                      ? 'Every action is a Monad transaction, about 0.02 MON each. The test faucet sends 0.2 MON when you are low, at most once every 10 minutes, and any action tops you up first.'
                      : 'Every action is a Monad transaction, paid in MON. Send a little MON to your address under Deposit. It is not covered for you.'}
                  </p>
                  {monMsg && <p className="fine" role="status">{monMsg}</p>}
                </div>
                {net.name === 'testnet' && <Button variant="secondary" size={48} pending={busy} onClick={getMon}>Get test MON</Button>}
              </div>
            )}
          </div>
        </>
      )}
    </dialog>
  )
}

/** Send cash to an address you choose: checksum checked, the network named, a Max, a review, and an extra check for a new address. */
function Withdraw({ account, onDone }: { account: LocalAccount; onDone: () => void }) {
  const p = usePortfolio(account.address)
  const tx = useTx()
  const [to, setTo] = useState('')
  const [amt, setAmt] = useState('')
  const [ack, setAck] = useState(false)
  const [errs, setErrs] = useState<string[]>([])
  const d = p.data
  const available = d ? d.cashRaw + d.exCashRaw : 0n
  const fresh = isAddress(to, { strict: true }) && !known().includes(getAddress(to))
  const review = () => {
    const e: string[] = []
    const units = parseAmount(amt)
    if (!isAddress(to, { strict: true })) e.push(to ? 'That is not a valid address, or its capital letters do not match its checksum. Copy it again from the source.' : 'Enter the address to send to.')
    else if (getAddress(to) === getAddress(account.address)) e.push('That is your own address.')
    if (units === undefined || units <= 0n) e.push('Enter an amount with at most six decimals.')
    else if (units > available) e.push(`You have ${usd(available, 2)} available.`)
    if (fresh && !ack) e.push('Confirm that you checked this address. Cash sent to a wrong address cannot be recovered.')
    if (d && d.gas < 2n * 10n ** 16n && net.name !== 'testnet') e.push('You need MON for the network fee. Send some to your address under Deposit.')
    setErrs(e)
    if (e.length || !d || units === undefined) return
    const dest = getAddress(to)
    const fromExchange = units > d.cashRaw ? units - d.cashRaw : 0n
    const steps: StepSpec[] = []
    if (fromExchange > 0n) steps.push({ id: 'pull', label: `Move ${usd(fromExchange)} from the exchange to your wallet`, run: (h) => sendTx(account, { address: d.ma, abi: marginAbi, functionName: 'withdraw', args: [fromExchange, net.quote] }, h) })
    steps.push({ id: 'send', label: `Send ${usd(units)} to ${dest.slice(0, 6)}…${dest.slice(-4)}`, run: (h) => sendTx(account, { address: net.quote, abi: erc20Abi, functionName: 'transfer', args: [dest, units] }, h) })
    onDone()
    tx.open({
      kind: 'withdraw',
      account,
      title: 'Move cash to a wallet',
      summary: [`You send ${usd(units, 2)} to ${dest} on ${net.chain.name}. It leaves your account.`, ...(fresh ? [`This is the first time you send to ${dest}. Check every character.`] : [])],
      rows: [{ label: 'To', value: `${dest.slice(0, 10)}…${dest.slice(-8)}`, note: `On ${net.chain.name}, chain ID ${net.chain.id}` }, { label: 'Amount', value: usd(units, 2) }, { label: 'Platform fee', value: '$0', note: 'Tivan charges nothing to move cash out' }, { label: 'Network fee', value: `about ${(0.02 * steps.length).toFixed(2)} MON`, note: 'An estimate, paid in MON' }],
      total: { label: 'You send', value: usd(units, 2) },
      confirmLabel: `Send ${usd(units)}`,
      steps,
      reconcile: async () => void (await p.refresh()),
      receiptSentence: `Sent ${usd(units, 2)} to ${dest.slice(0, 6)}…${dest.slice(-4)}.`,
      amountUnits: -units,
    })
    try {
      localStorage.setItem(KNOWN, JSON.stringify([...new Set([...known(), dest])]))
    } catch {}
  }
  return (
    <div className="withdraw">
      <label className="lab">
        Send to this address
        <input className="num-in addr" value={to} onChange={(e) => setTo(e.target.value.trim())} placeholder="0x…" spellCheck={false} autoComplete="off" aria-label="Destination address" />
      </label>
      <p className="fine">On {net.chain.name}, chain ID {net.chain.id}. Only send to an address on this network.</p>
      <label className="lab">
        Amount
        <span className="amt-row">
          <input className="num-in" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.,$]/g, ''))} placeholder="0.00" aria-label="Amount in dollars" />
          <Button variant="tertiary" size={32} onClick={() => setAmt(toDecimal(available).replace(/\.?0+$/, ''))}>Max</Button>
        </span>
      </label>
      <p className="fine">Available {d ? usd(available, 2) : '…'}. Tivan charges no fee to move cash out; the network fee is paid in MON.</p>
      {fresh && <Opt type="checkbox" checked={ack} onChange={setAck} label="I checked this new address" />}
      {errs.length > 0 && <ul className="problems" role="alert">{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
      <Button size={48} onClick={review}>Review transfer</Button>
    </div>
  )
}

/** "Monad Testnet" as text in the header; it opens the network panel. */
export function NetworkChip() {
  const dlg = useRef<HTMLDialogElement>(null)
  const [on, setOn] = useState(false)
  useOnClose(dlg, () => setOn(false))
  return (
    <>
      <button className="chip-b net-chip" onClick={() => (setOn(true), later(() => dlg.current?.showModal()))}>
        {net.chain.name}
      </button>
      <dialog ref={dlg} className="tx-dialog" aria-labelledby="net-title" onClick={(e) => e.target === dlg.current && dlg.current?.close()}>
        <div className="tx-head"><h2 id="net-title">Network</h2><button className="ghost line s32" autoFocus onClick={() => dlg.current?.close()}>Close</button></div>
        {on && <NetworkInfo />}
      </dialog>
    </>
  )
}

function NetworkInfo() {
  const probe = usePoll(async () => {
    const t0 = performance.now()
    const block = await pub.getBlockNumber()
    return { block, ms: Math.round(performance.now() - t0) }
  }, 2000, [])
  const log = useTxLog().filter((e) => e.seconds !== undefined && e.status === 'Confirmed').slice(0, 20)
  const secs = log.map((e) => e.seconds!).sort((a, b) => a - b)
  const median = secs.length ? secs[Math.floor(secs.length / 2)] : undefined
  const r = probe.data
  return (
    <dl className="tx-rows">
      <div><dt>Network</dt><dd>{net.chain.name}</dd></div>
      <div><dt>Chain ID</dt><dd>{net.chain.id}</dd></div>
      <div><dt>Latest block</dt><dd>{r ? `#${r.block}` : probe.error ? 'Not available' : 'Checking…'}<small>Read from the network every 2 seconds</small></dd></div>
      <div><dt>RPC status</dt><dd>{probe.error && !r ? 'Not responding' : r ? (r.ms < 1500 ? `Responding in ${r.ms} ms` : `Slow: ${r.ms} ms`) : 'Checking…'}</dd></div>
      <div><dt>Your confirmation time</dt><dd>{median !== undefined ? `${median.toFixed(1)} s median across your last ${secs.length} transaction${secs.length === 1 ? '' : 's'}` : 'No transactions of yours measured yet'}<small>Measured from send to confirmation on this device</small></dd></div>
      <div><dt>Explorer</dt><dd><a className="u" href={net.chain.blockExplorers?.default.url} target="_blank" rel="noreferrer">{net.chain.blockExplorers?.default.name ?? 'Open'}</a></dd></div>
    </dl>
  )
}
