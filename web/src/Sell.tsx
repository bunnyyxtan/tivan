import { useEffect, useRef, useState } from 'react'
import { PageHead } from './kit'
import type { LocalAccount } from 'viem'
import { OrderForm, useMarket } from './Card'
import { Define, SpreadBar, cents, usdC } from './cardParts'
import { Button } from './controls'
import { attestorUrl, catalog, net } from './config'
import { erc20Abi, hasMarket, pub, vaultAbi } from './chain'
import type { Ctx, Funds } from './flows'
import { aggregate } from './logic/orders.ts'
import { usePortfolio } from './portfolio'
import { Slab, cardSub, cardTitle } from './ui'
import { post } from './attestor'
import { writeLog } from './tx'

// "Sell your card": choose a method, find the slab by scanning or typing its certificate, confirm it, check it into the vault,
// then price it. The check and the check-in are simulated on the test network and say so where they happen.

type Step = 'method' | 'scan' | 'cert' | 'vault' | 'price'
type Found = { specId: string; grade: number; subject: string; card?: (typeof catalog)[number] }

const NOTES = 'tivan.notes'
const readNotes = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(NOTES) ?? '{}')
  } catch {
    return {}
  }
}
/** A private note on one slab, kept on this device and shown to nobody else. */
function PrivateNote({ cert }: { cert: string }) {
  const [text, setText] = useState(() => readNotes()[cert] ?? '')
  return (
    <label className="lab">
      Private note on this slab
      <textarea
        className="field note-in"
        rows={2}
        value={text}
        placeholder="Where you bought it, what it is worth to you…"
        onChange={(e) => {
          setText(e.target.value)
          try {
            localStorage.setItem(NOTES, JSON.stringify({ ...readNotes(), [cert]: e.target.value }))
          } catch {}
        }}
      />
      <span className="fine">Only you can see this, and only on this device. It is not sent anywhere.</span>
    </label>
  )
}

/** The certificate number from what a label barcode or QR code holds: a PSA cert URL, or the number itself. */
export const parseCert = (raw: string): string | undefined => /cert\/(\d{7,10})/i.exec(raw)?.[1] ?? /\b(\d{7,10})\b/.exec(raw)?.[1]

type BD = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> }
const detectorCtor = (): (new (o: { formats: string[] }) => BD) | undefined => (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BD }).BarcodeDetector
const canScan = () => !!navigator.mediaDevices?.getUserMedia && !!detectorCtor()

/** Reads the slab label's barcode or QR code on this device. Frames are never uploaded. */
function Scanner({ onFound, onManual }: { onFound: (cert: string) => void; onManual: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | undefined>(undefined)
  const [live, setLive] = useState(false)
  const [msg, setMsg] = useState<string>()
  const [torch, setTorch] = useState<boolean | undefined>(undefined)
  const stop = () => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = undefined
  }
  useEffect(() => stop, [])
  const start = async () => {
    setMsg(undefined)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      stream.current = s
      const track = s.getVideoTracks()[0]
      if ((track.getCapabilities?.() as { torch?: boolean } | undefined)?.torch) setTorch(false)
      setLive(true)
      const el = video.current!
      el.srcObject = s
      await el.play()
      const det = new (detectorCtor()!)({ formats: ['qr_code', 'code_128', 'code_39', 'itf', 'ean_13', 'data_matrix'] })
      const loop = async () => {
        if (!stream.current) return
        try {
          for (const r of await det.detect(el)) {
            const c = parseCert(r.rawValue)
            if (c) return void (stop(), onFound(c))
          }
        } catch {}
        setTimeout(loop, 250)
      }
      loop()
    } catch (e) {
      stop()
      setLive(false)
      setMsg((e as { name?: string }).name === 'NotAllowedError' ? 'Camera access was declined, so nothing was scanned. You can type the certificate number instead.' : 'The camera could not be opened. You can type the certificate number instead.')
    }
  }
  const flip = async () => {
    const track = stream.current?.getVideoTracks()[0]
    try {
      await track?.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      setTorch(!torch)
    } catch {}
  }
  return (
    <div className="scan">
      {!live ? (
        <>
          <p>We use your camera only to read the barcode or QR code on the slab’s label. Frames are processed on this device and are never uploaded.</p>
          <Button size={48} onClick={start}>Open camera</Button>
        </>
      ) : (
        <>
          <div className="vf">
            <video ref={video} playsInline muted aria-label="Camera view of the slab label" />
            <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
          </div>
          <ul className="plain">
            <li>Hold the slab flat so the label fills the frame.</li>
            <li>Avoid glare from lamps and windows on the plastic.</li>
            <li>Move closer until the barcode is sharp.</li>
          </ul>
          {torch !== undefined && <Button variant="secondary" size={40} aria-pressed={torch} onClick={flip}>{torch ? 'Turn the light off' : 'Turn the light on'}</Button>}
        </>
      )}
      {msg && <p className="problems" role="alert">{msg}</p>}
      <p><button className="linkbtn" onClick={() => (stop(), onManual())}>Type the number instead</button></p>
    </div>
  )
}

export function Sell({ account }: { account: LocalAccount }) {
  const me = account.address
  const [step, setStep] = useState<Step>('method')
  const [cert, setCert] = useState('')
  const [found, setFound] = useState<Found>()
  const [state, setState] = useState<{ text: string; ok: boolean }>()
  const [sku, setSku] = useState<string>()
  const port = usePortfolio(me)
  const mine = (port.data?.holdings ?? []).filter((h) => h.count > 0)

  useEffect(() => {
    setFound(undefined)
    setState(undefined)
    if (!/^\d{7,12}$/.test(cert)) return
    const ctl = new AbortController()
    setState({ text: 'Checking the certificate…', ok: false })
    fetch(`${attestorUrl}/cert/${cert}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : r.status === 404 ? { missing: true } : undefined))
      .then(async (j?: { specId?: string; grade?: number; subject?: string; missing?: boolean }) => {
        if (!j) return setState({ text: 'The certificate check could not be reached. Try again in a moment.', ok: false })
        if (j.missing) return setState({ text: 'Certificate not found. Check the number on the label and try again.', ok: false })
        const known = await pub.readContract({ address: net.vault!, abi: vaultAbi, functionName: 'certs', args: [BigInt(cert)] }).catch(() => undefined)
        if (known && known[2] !== 0) return setState({ text: 'This certificate is already in the vault.', ok: false })
        const card = catalog.find((c) => c.specId.toString() === j.specId)
        if (!card) return setState({ text: `We found ${j.subject}, but that card is not supported here yet.`, ok: false })
        setFound({ specId: j.specId!, grade: j.grade!, subject: j.subject!, card })
        setState({ text: 'Found', ok: true })
      })
      .catch((e) => e.name !== 'AbortError' && setState({ text: 'The certificate check could not be reached. Try again in a moment.', ok: false }))
    return () => ctl.abort()
  }, [cert])

  return (
    <div className="sell">
      <PageHead title="Sell a card" sub="Check your slab into the vault, then list it on its market. You are paid the moment an order fills." />
      <ol className="stepper" aria-label="Steps">
        {(['Find your card', 'Check into the vault', 'Set your price'] as const).map((t, i) => {
          const at = step === 'price' ? 2 : step === 'vault' ? 1 : 0
          return <li key={t} className={i < at ? 'done' : i === at ? 'on' : ''} aria-current={i === at ? 'step' : undefined}><span>{i + 1}</span>{t}</li>
        })}
      </ol>
      <div className="sell-grid">
      <div className="sell-main">
      {step === 'method' && (
        <ul className="methods">
          <li>
            <h2>Scan the slab</h2>
            <p className="fine">Point your camera at the barcode on the label.</p>
            {canScan() ? <Button size={40} onClick={() => setStep('scan')}>Scan the label</Button> : <p className="fine">Scanning is not available in this browser: it needs camera access and barcode reading. Type the number instead.</p>}
          </li>
          <li>
            <h2>Enter the certificate number</h2>
            <p className="fine">The number printed on the slab’s label.</p>
            <Button variant="secondary" size={40} onClick={() => setStep('cert')}>Enter the number</Button>
          </li>
          <li>
            <h2>Sell a card already in the vault</h2>
            {port.data ? mine.length ? (
              <ul className="plain">{mine.map((h) => <li key={h.s.sku}><button className="linkbtn" onClick={() => (setSku(h.s.sku), setStep('price'))}>{cardTitle(h.s.name)}, {cardSub(h.s.name).split(' · ')[0]}</button> ({h.count} held)</li>)}</ul>
            ) : <p className="fine">You hold no cards yet.</p> : <p className="fine">Checking your cards…</p>}
          </li>
        </ul>
      )}
      {step === 'scan' && <Scanner onFound={(c) => (setCert(c), setStep('cert'))} onManual={() => setStep('cert')} />}
      {step === 'cert' && (
        <section className="sell-cert">
          <label className="lab">
            PSA certificate number
            <input className="num-in addr" inputMode="numeric" value={cert} onChange={(e) => setCert(e.target.value.replace(/\D/g, ''))} placeholder="Eight to ten digits" aria-label="PSA certificate number" />
          </label>
          {state && !found && <p className={state.ok ? 'fine' : 'problems'} role="status">{state.text}</p>}
          {found?.card && (
            <div className="found">
              <Slab name={`PSA ${found.grade} ${found.card.title}`} size="sm" />
              <div>
                <h2>{found.card.title}</h2>
                <p className="muted">{found.card.set} · PSA {found.grade}</p>
                <p className="fine">{net.name === 'testnet' ? 'Simulated check: this certificate was matched against a demo registry.' : 'Matched against the grader’s registry by the attestor.'} Population data is not available.</p>
                <Button size={48} onClick={() => setStep('vault')}>This is my card</Button>
              </div>
            </div>
          )}
        </section>
      )}
      {step === 'vault' && found?.card && <VaultSteps account={account} cert={cert} found={found} onReady={(s) => (setSku(s), setStep('price'))} />}
      {step === 'price' && sku && <Price sku={sku} account={account} />}
      </div>
      <aside className="sell-aside" aria-label="How selling works">
        <h2>How selling works</h2>
        <dl>
          <div><dt>Verification</dt><dd>{net.name === 'testnet' ? 'Simulated check against a demo registry.' : 'Your certificate is matched against the grader’s registry.'}</dd></div>
          <div><dt>Custody</dt><dd>{net.name === 'testnet' ? 'Simulated: a demo custodian confirms receipt at once.' : 'A vault partner confirms the slab arrived before it can trade.'}</dd></div>
          <div><dt>Listing</dt><dd>Your ask joins the card’s order book. Cancel it any time before it fills.</dd></div>
          <div><dt>Fees</dt><dd>Shown on the review screen before you confirm, read from the market.</dd></div>
        </dl>
        <a className="u" href="#/help?s=custody">Custody and verification</a>
      </aside>
      </div>
    </div>
  )
}

type VStep = { label: string; note?: string; status: 'todo' | 'doing' | 'done' | 'failed'; at?: number }
/** Check-in as text: Requested, Verified, Received, Tokenised, each with its time and its simulation label. */
function VaultSteps({ account, cert, found, onReady }: { account: LocalAccount; cert: string; found: Found; onReady: (sku: string) => void }) {
  const card = found.card!
  const test = net.name === 'testnet'
  const [steps, setSteps] = useState<VStep[]>([
    { label: 'Requested', status: 'todo' },
    { label: 'Verified', note: test ? 'Simulated check against a demo registry' : undefined, status: 'todo' },
    { label: 'Received', note: test ? 'Simulated: a demo custodian confirms receipt at once' : 'A vault partner confirms the slab arrived', status: 'todo' },
    { label: 'Tokenised', status: 'todo' },
  ])
  const [err, setErr] = useState<string>()
  const [sku, setSku] = useState<string>()
  const started = useRef(false)
  const mark = (i: number, status: VStep['status']) => setSteps((s) => s.map((x, k) => (k === i ? { ...x, status, at: status === 'done' ? Date.now() : x.at } : x)))
  const run = async () => {
    setErr(undefined)
    try {
      mark(0, 'doing')
      const name = `PSA ${found.grade} ${card.title}`
      mark(0, 'done')
      mark(1, 'doing')
      await post('/attest', { certId: cert, specId: found.specId, grade: found.grade, holder: account.address, name, symbol: `PSA${found.grade}-${card.short}` })
      mark(1, 'done')
      if (!test) return void setErr('Verified. The vault partner must receive the physical slab before it is tokenised, so you will see it here once they do.')
      mark(2, 'doing')
      await post('/custody', { certId: cert })
      mark(2, 'done')
      mark(3, 'doing')
      const s = await pub.readContract({ address: net.vault!, abi: vaultAbi, functionName: 'skuOf', args: [BigInt(found.specId), found.grade] })
      const [token] = await pub.readContract({ address: net.vault!, abi: vaultAbi, functionName: 'skuInfo', args: [s] })
      const bal = await pub.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })
      if (bal < 1n) throw new Error('not credited')
      mark(3, 'done')
      writeLog((l) => [{ id: `vault-${cert}`, t: Date.now(), kind: 'vault', title: 'Vault', sentence: `Checked ${card.title}, PSA ${found.grade} into the vault.`, status: 'Confirmed', feeSpent: false, sku: s }, ...l])
      setSku(s)
    } catch (e) {
      setSteps((s) => s.map((x) => (x.status === 'doing' ? { ...x, status: 'failed' } : x)))
      const m = (e as Error).message
      setErr(/already in the vault/.test(m) ? 'This certificate is already in the vault.' : /not credited/.test(m) ? 'The card was verified but the token has not arrived yet. Check again in a moment.' : 'The check-in did not finish, so nothing changed. Try again in a moment.')
    }
  }
  return (
    <section className="vsteps">
      <h2>{card.title}, PSA {found.grade}</h2>
      <ol className="tx-steps">
        {steps.map((s) => (
          <li key={s.label} data-status={s.status === 'done' ? 'confirmed' : s.status === 'doing' ? 'sent' : s.status === 'failed' ? 'failed' : 'todo'}>
            <b>{s.label}</b>
            <span className="fine">{s.status === 'done' ? `Done at ${new Date(s.at!).toLocaleTimeString()}` : s.status === 'doing' ? 'In progress' : s.status === 'failed' ? 'Did not complete' : 'Waiting'}</span>
            {s.note && <span className="fine">{s.note}</span>}
          </li>
        ))}
      </ol>
      {err && <p className={sku ? 'fine' : 'problems'} role="alert">{err}</p>}
      {!started.current && steps[0].status === 'todo' && <Button size={48} onClick={() => ((started.current = true), run())}>Check it into the vault</Button>}
      {steps.some((s) => s.status === 'failed') && <Button variant="secondary" size={40} onClick={run}>Try again</Button>}
      {sku && (
        <>
          <p className="tx-sum">It is in the vault and tokenised. It is yours to price.</p>
          <PrivateNote cert={cert} />
          <Button size={48} onClick={() => onReady(sku)}>Price it</Button>
        </>
      )}
    </section>
  )
}

/** Market context first, never advice, then the same order form and review as the card page. */
function Price({ sku, account }: { sku: string; account: LocalAccount }) {
  const { m, h } = useMarket(sku)
  const port = usePortfolio(account.address, true)
  const d = m.data
  if (!d) return <p className="fine">Loading the market…</p>
  const { s, book, rules } = d
  const asks = aggregate(book.asks, 'ask')
  const bids = aggregate(book.bids, 'bid')
  const hold = port.data?.holdings.find((x) => x.s.sku === sku)
  const funds: Funds | undefined = port.data && { ma: port.data.ma, cashRaw: port.data.cashRaw, exCashRaw: port.data.exCashRaw, wallet: hold?.wallet ?? 0n, onBook: hold?.onBook ?? 0n, gas: port.data.gas }
  const label = `${cardTitle(s.name)}, ${cardSub(s.name).split(' · ')[0]}`
  const last = h.data?.fills.at(-1)
  const ctx: Ctx | undefined = funds && rules && hasMarket(s) ? { account, s, label, rules, funds, reconcile: async () => void (await Promise.all([m.refresh(), h.refresh(), port.refresh()])) } : undefined
  return (
    <section className="price-step">
      <h2>Price {label}</h2>
      <dl className="vals">
        <div><dt>Ask <Define term="ask">The lowest price anyone is asking right now.</Define></dt><dd>{asks[0] ? usdC(asks[0].price) : '—'}</dd></div>
        <div><dt>Best offer <Define term="best offer">The highest price anyone is bidding right now.</Define></dt><dd>{bids[0] ? usdC(bids[0].price) : '—'}</dd></div>
        <div><dt>Last sale</dt><dd>{last ? usdC(cents(last.price)) : '—'}</dd></div>
      </dl>
      <SpreadBar bid={bids[0]?.price} ask={asks[0]?.price} last={last ? cents(last.price) : undefined} />
      {h.data && h.data.fills.length > 0 && <p className="fine">Recent trades: {h.data.fills.slice(-5).reverse().map((f) => usdC(cents(f.price))).join(', ')}. This is context, not advice.</p>}
      {ctx ? <OrderForm mode="sell" ctx={ctx} asks={book.asks} bids={book.bids} askC={asks[0]?.price} bidC={bids[0]?.price} owned={(hold?.wallet ?? 0n) + (hold?.onBook ?? 0n)} prefill={{}} onClose={() => (location.hash = `#/card/${sku}`)} /> : <p className="fine">Reading your balances…</p>}
    </section>
  )
}
