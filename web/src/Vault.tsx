import { useEffect, useState } from 'react'
import { keccak256, parseEventLogs, toBytes, type LocalAccount } from 'viem'
import { confirmStep } from './account'
import { attestorUrl, catalog, net } from './config'
import { erc20Abi, loadSkus, marginAbi, marginAccount, pub, send, vaultAbi } from './chain'
import { usePortfolio } from './portfolio'
import { Header, Slab, Steps, cardSub, cardTitle, useFlow, usePoll, useTint } from './ui'

async function post(path: string, body: object) {
  const res = await fetch(attestorUrl + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
  if (!res.ok) throw new Error(/cert known/.test(j.error) ? 'This cert is already in the vault.' : (j.error ?? `HTTP ${res.status}`))
  return j as { txHash?: string; verifiedBy?: string }
}
// Deposits you have started, kept in this browser so the vault can show where each one is.
type Deposit = { cert: string; name: string; t: number }
const DEP = 'tivan.deposits'
const readDeposits = (): Deposit[] => {
  try {
    return JSON.parse(localStorage.getItem(DEP) ?? '[]')
  } catch {
    return []
  }
}
const saveDeposit = (d: Deposit) => {
  try {
    localStorage.setItem(DEP, JSON.stringify([d, ...readDeposits().filter((x) => x.cert !== d.cert)].slice(0, 10)))
  } catch {}
}

export const drip = (address: string) => post('/drip', { address })

export function VaultPage({ account }: { account: LocalAccount }) {
  const [cert, setCert] = useState('')
  const [pick, setPick] = useState(0)
  const [grade, setGrade] = useState(10)
  const [found, setFound] = useState<{ ok: boolean; text: string }>()
  const [source, setSource] = useState<string>()
  const [deps, setDeps] = useState(readDeposits)
  const flow = useFlow()
  const { data: port, refresh } = usePortfolio(account.address)
  const card = catalog[pick]
  const name = `PSA ${grade} ${card.title}`
  const certOk = /^\d{6,12}$/.test(cert)
  const done = flow.steps.length > 0 && flow.steps.every((s) => s.state === 'done')

  // Look the cert up in the grader registry as soon as a full number is typed, and fill in the card and grade.
  useEffect(() => {
    setFound(undefined)
    if (!/^\d{8,12}$/.test(cert)) return
    const ctl = new AbortController()
    setFound({ ok: false, text: 'Checking with PSA…' })
    fetch(`${attestorUrl}/cert/${cert}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : r.status === 404 ? { missing: true } : undefined))
      .then((j?: { specId?: string; grade?: number; subject?: string; missing?: boolean }) => {
        if (!j) return setFound(undefined)
        if (j.missing) return setFound({ ok: false, text: 'Not found in the PSA registry. Check the number on the label.' })
        const i = catalog.findIndex((c) => c.specId.toString() === j.specId)
        if (i >= 0) setPick(i)
        if (j.grade) setGrade(j.grade)
        setFound(i >= 0 ? { ok: true, text: `Found: ${catalog[i].title}, PSA ${j.grade}` } : { ok: false, text: `Found ${j.subject}, but it isn’t tradable here yet` })
      })
      .catch(() => setFound(undefined))
    return () => ctl.abort()
  }, [cert])

  const submit = () =>
    flow
      .run([
        [
          'Grade checked with PSA',
          async () => {
            const r = await post('/attest', { certId: cert, specId: card.specId.toString(), grade, holder: account.address, name, symbol: `PSA${grade}-${card.short}` })
            setSource(r.verifiedBy)
            saveDeposit({ cert, name, t: Date.now() })
            setDeps(readDeposits())
            return r.txHash
          },
        ],
        // NOTE: the demo custodian confirms receipt immediately; in production this step waits for the slab to arrive.
        // On mainnet /custody is custodian-only, so the flow stops at checked until the slab is received.
        ...(net.name !== 'testnet'
          ? []
          : ([
              ['Checked in to the vault (simulated)', async () => (await post('/custody', { certId: cert })).txHash],
              [
                'Ready to trade',
                async () => {
                  const sku = await pub.readContract({ address: net.vault!, abi: vaultAbi, functionName: 'skuOf', args: [card.specId, grade] })
                  const [token] = await pub.readContract({ address: net.vault!, abi: vaultAbi, functionName: 'skuInfo', args: [sku] })
                  const bal = await pub.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] })
                  if (bal < 1n) throw new Error('Card not credited yet')
                },
              ],
            ] as [string, () => Promise<string | void>][])),
      ])
      .then((ok) => ok && refresh())

  const mine = (port?.holdings ?? []).filter((h) => h.count > 0)
  return (
    <>
      <Header title="Vault" />
      <section className="panel rise">
        <div className="item">
          <Slab name={name} size="xs" />
          <div style={{ minWidth: 0 }}>
            <b style={{ fontWeight: 500, fontSize: 17 }}>Vault a card</b>
            <p className="fine" style={{ marginTop: 2 }}>
              Type the cert number from the slab’s label. Chainlink checks it against the PSA registry before anything is listed.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
          <label className="lab">
            PSA cert number
            <span className="field">
              <input inputMode="numeric" autoComplete="off" placeholder="81234567" value={cert} onChange={(e) => setCert(e.target.value.replace(/\D/g, ''))} style={{ letterSpacing: '0.06em' }} />
            </span>
          </label>
          <p className="fine" role="status" style={{ color: found?.ok ? 'var(--up)' : undefined, minHeight: 19 }}>
            {found?.text ?? ''}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 96px', gap: 8 }}>
            <label className="lab">
              Card
              <span className="field">
                <select value={pick} onChange={(e) => setPick(Number(e.target.value))}>
                  {catalog.map((c, i) => (
                    <option key={i} value={i}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </span>
            </label>
            <label className="lab">
              Grade
              <span className="field">
                <select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
                  {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </span>
            </label>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          {flow.steps.length ? (
            <Steps steps={flow.steps} error={flow.error} />
          ) : (
            <ol className="timeline">
              <li className="todo">
                1. Grade checked with PSA
              </li>
              <li className="todo">
                2. Slab checked in to the vault
              </li>
              <li className="todo">
                3. Ready to trade
              </li>
            </ol>
          )}
        </div>
        {done ? (
          <a className="btn wide" href="#/collection" style={{ marginTop: 14 }}>
            See it in Collection
          </a>
        ) : (
          <button className="btn wide" disabled={!certOk || flow.busy} onClick={submit} style={{ marginTop: 14 }}>
            {flow.busy && <span className="spin" aria-hidden />}
            {flow.doing ?? 'Check and vault'}
          </button>
        )}
        <p className="fine" style={{ marginTop: 10 }}>
          {source === 'fixtures' ? 'Checked against the demo registry (testnet). ' : ''}
          Demo: custody is simulated. In production, a vault partner checks the slab in before it can trade.
        </p>
      </section>

      {deps.length > 0 && (
        <section className="section">
          <span className="cap">Your deposits</span>
          {deps.map((d) => {
            const ready = mine.some((h) => h.s.name === d.name)
            return (
              <div key={d.cert} className="panel" style={{ marginTop: 8 }}>
                <div className="item">
                  <Slab name={d.name} size="xs" />
                  <div>
                    <div className="item-title">{cardTitle(d.name)}</div>
                    <div className="fine" style={{ fontSize: 14 }}>
                      {cardSub(d.name)} · cert {d.cert}
                    </div>
                  </div>
                </div>
                <ol className="timeline" style={{ marginTop: 10 }}>
                  <li className="done">
                    Grade checked with PSA
                    <span className="muted" style={{ marginLeft: 'auto' }}>{new Date(d.t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </li>
                  <li className={ready ? 'done' : 'now'}>
                    {ready ? 'Checked in to the vault' : 'Waiting for the slab to arrive'}
                  </li>
                  <li className={ready ? 'done' : 'todo'}>
                    Ready to trade
                  </li>
                </ol>
                {!ready && <p className="fine">Carrier tracking appears here once a vault partner is live.</p>}
              </div>
            )
          })}
        </section>
      )}

      <section className="section">
        <span className="cap">In the vault for you</span>
        {port && !mine.length && <p className="fine">Nothing yet.</p>}
        <div className="rows">
          {mine.map((h) => (
            <a key={h.s.sku} className="mrow" href={`#/card/${h.s.sku}`}>
              <Slab name={h.s.name} size="xs" />
              <span className="mrow-info">
                <span className="mrow-title">{cardTitle(h.s.name)}</span>
                <span className="mrow-sub">
                  {cardSub(h.s.name)} · {h.count} held
                </span>
              </span>
              <span className="muted">›</span>
            </a>
          ))}
        </div>
      </section>
    </>
  )
}

export function Redeem({ sku, account }: { sku: string; account: LocalAccount }) {
  const { data } = usePoll(
    async () => {
      const s = (await loadSkus()).find((x) => x.sku === sku)
      if (!s) throw new Error('Card not found')
      const ma = await marginAccount()
      const [held, onExchange] = await Promise.all([
        pub.readContract({ address: s.token, abi: erc20Abi, functionName: 'balanceOf', args: [account.address] }),
        pub.readContract({ address: ma, abi: marginAbi, functionName: 'getBalance', args: [account.address, s.token] }),
      ])
      return { s, held, onExchange, ma }
    },
    6000,
    [sku],
  )
  useTint(data?.s.name)
  const [ship, setShip] = useState('')
  const [ok, setOk] = useState(false)
  const [certId, setCertId] = useState<bigint>()
  const flow = useFlow()
  const go = () =>
    flow.run([
      ...confirmStep(account),
      // A card from a filled offer or cancelled listing sits on the exchange; bring one back first.
      ...(data && data.held < 1n
        ? [['Bringing your card off the exchange', async () => (await send(account, { address: data.ma, abi: marginAbi, functionName: 'withdraw', args: [1n, data.s.token] })).transactionHash] as [string, () => Promise<string>]]
        : []),
      [
        'Request recorded, token retired',
        async () => {
          const r = await send(account, { address: net.vault!, abi: vaultAbi, functionName: 'redeem', args: [sku as `0x${string}`, keccak256(toBytes(ship.trim()))] })
          setCertId(parseEventLogs({ abi: vaultAbi, eventName: 'Redeemed', logs: r.logs })[0].args.certId)
          return r.transactionHash
        },
      ],
    ])
  const own = data ? data.held + data.onExchange : 0n
  return (
    <div className="flow">
      <Header back={`#/card/${sku}`} backLabel="Cancel" title="Request the card" />
      {data && <div className="item">
        <Slab name={data.s.name} size="xs" />
        <div>
          <div className="item-title">{cardTitle(data.s.name)}</div>
          <div className="fine" style={{ fontSize: 14 }}>
            {cardSub(data.s.name)} · you own {own.toString()}
          </div>
        </div>
      </div>}
      {certId !== undefined ? (
        <>
          <div className="result">
            <h1 className="big">Requested.</h1>
            <p className="muted">PSA cert #{certId.toString()} is assigned to you. The vault releases the oldest copy of this grade first, so nobody can cherry-pick.</p>
          </div>
          <Steps steps={flow.steps} />
          <p className="notice">
            <b>Demo:</b> no physical cards are held yet, so nothing ships. In production the vault custodian contacts you to arrange insured shipping.
          </p>
        </>
      ) : (
        <>
          <label className="lab">
            Shipping address
            <textarea className="field" rows={3} value={ship} onChange={(e) => setShip(e.target.value)} placeholder={'Name\nStreet\nCity, postcode'} />
          </label>
          {/* NOTE: only a hash of the address is recorded; the custodian gets the plaintext out of band. */}
          <div className="rows">
            <div className="kv">
              <span>Who ships it</span>
              <span>The vault custodian, insured</span>
            </div>
            <div className="kv">
              <span>Next step</span>
              <span>They contact you to arrange it</span>
            </div>
            <div className="kv">
              <span>Shipping cost</span>
              <span>Quoted by the custodian</span>
            </div>
            <div className="kv">
              <span>Recorded publicly</span>
              <span>Only a fingerprint of your address</span>
            </div>
          </div>
          <p className="notice">
            <b>What changes:</b> when you confirm, your token is retired and the card can no longer be traded here. Demo: no physical cards are held yet, so nothing ships.
          </p>
          <button className="check" role="checkbox" aria-checked={ok} onClick={() => setOk(!ok)}>
            <i aria-hidden>{ok ? '✓' : ''}</i>I understand it stops being tradable when I confirm.
          </button>
          <Steps steps={flow.steps} error={flow.error} />
          <button className="btn wide" disabled={!data || own < 1n || ship.trim().length < 10 || !ok || flow.busy} onClick={go}>
            {flow.busy && <span className="spin" aria-hidden />}
            {flow.doing ?? (account.source === 'mera' ? 'Request it with Face ID' : 'Request the card')}
          </button>
        </>
      )}
    </div>
  )
}
