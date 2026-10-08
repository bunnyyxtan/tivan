import { useState } from 'react'
import { keccak256, parseEventLogs, toBytes, type LocalAccount } from 'viem'
import { confirmStep } from './account'
import { net } from './config'
import { erc20Abi, loadSkus, marginAbi, marginAccount, pub, send, vaultAbi } from './chain'
import { Header, Slab, Steps, cardSub, cardTitle, useFlow, usePoll } from './ui'

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
