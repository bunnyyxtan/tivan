import { useState } from 'react'
import { parseEventLogs, type LocalAccount } from 'viem'
import { net } from './config'
import { bookAbi, decodeL2, erc20Abi, explorerTx, hasMarket, lastPaid, loadSkus, marginAbi, marginAccount, pub, send, tradeHistory } from './chain'
import { usePortfolio } from './portfolio'
import { confirmStep } from './account'
import { logActivity } from './activity'
import { useAlerts } from './alerts'
import { Skeleton } from './States'
import { Header, Slab, Steps, Toast, cardSub, cardTitle, delta, useFlow, usePoll, usd } from './ui'

const toUnits = (dollars: number) => BigInt(Math.round(dollars * 100)) * 10n ** BigInt(net.quoteDecimals - 2)

/** The card plus a freshly read top of book. */
function useCard(sku: string) {
  return usePoll(
    async () => {
      const s = (await loadSkus()).find((x) => x.sku === sku)
      if (!s) throw new Error('Card not found')
      const book = hasMarket(s) ? decodeL2(await pub.readContract({ address: s.market, abi: bookAbi, functionName: 'getL2Book' })) : { bids: [], asks: [] }
      return {
        s,
        ask: book.asks.length ? Math.min(...book.asks.map((l) => l.price)) : undefined,
        bid: book.bids.length ? Math.max(...book.bids.map((l) => l.price)) : undefined,
      }
    },
    5000,
    [sku],
  )
}

const Item = ({ name, note }: { name: string; note: string }) => (
  <div className="item">
    <Slab name={name} size="xs" />
    <div>
      <div className="item-title">{cardTitle(name)}</div>
      <div className="fine" style={{ fontSize: 14 }}>
        {note}
      </div>
    </div>
  </div>
)

function ListedAlert({ sku }: { sku: string }) {
  const al = useAlerts()
  const on = al.has(sku, 'listed')
  return (
    <button className="kv" style={{ width: '100%' }} onClick={async () => (on ? al.off(sku, 'listed') : await al.on({ sku, kind: 'listed' }))}>
      <span style={{ color: 'var(--ink)' }}>{on ? 'We’ll tell you when one is listed' : 'Tell me when one is listed'}</span>
      <i className="switch" role="switch" aria-checked={!!on} />
    </button>
  )
}

/** Where to send cash from any wallet: the account address itself (a plain ERC-20 transfer). */
function Deposit({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <section className="panel">
      <span className="cap">{net.mintableQuote ? `Or send TestUSD on ${net.chain.name}` : `Add USDC from any wallet on ${net.chain.name}`}</span>
      <button className="kv" style={{ width: '100%', wordBreak: 'break-all', textAlign: 'left' }} onClick={() => (navigator.clipboard?.writeText(address), setCopied(true), setTimeout(() => setCopied(false), 1500))}>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{address}</span>
        <span className="muted">{copied ? 'Copied' : 'Copy'}</span>
      </button>
      <p className="fine" style={{ marginTop: 8 }}>
        Arrives in about a second. Only send {net.mintableQuote ? 'TestUSD' : 'USDC'} on {net.chain.name} to this address.
      </p>
    </section>
  )
}

export function BuyFlow({ sku, account }: { sku: string; account: LocalAccount }) {
  const { data } = useCard(sku)
  const { data: port, refresh } = usePortfolio(account.address)
  const flow = useFlow()
  const [locked, setLocked] = useState<number>() // the price the buyer agreed to
  const [missed, setMissed] = useState(false)
  if (!data)
    return (
      <>
        <Header back={`#/card/${sku}`} backLabel="Card" />
        <Skeleton h={320} r={12} />
      </>
    )
  const price = locked ?? data.ask
  const cash = port ? port.cash + port.exCash : undefined
  const back = <Header back={`#/card/${sku}`} backLabel="Card" title="Buy" />

  if (missed)
    return (
      <div className="flow">
        {back}
        <span className="cap">Not charged</span>
        <h1 className="big" style={{ fontSize: 30 }}>
          Someone bought it a moment before you.
        </h1>
        <p className="muted" style={{ lineHeight: '22px' }}>
          Your cash is untouched. {data.ask ? `The next one is ${usd(data.ask)}.` : 'There are no other copies for sale right now.'}
        </p>
        <div className="rows panel" style={{ padding: '0 16px' }}>
          <a className="kv" href={`#/offer/${sku}`}>
            <span style={{ color: 'var(--ink)' }}>Make an offer at {usd(price)}</span>
            <span className="muted">›</span>
          </a>
          {data.ask ? (
            <button className="kv" style={{ width: '100%' }} onClick={() => (setMissed(false), setLocked(undefined), flow.reset())}>
              <span style={{ color: 'var(--ink)' }}>Review the next one at {usd(data.ask)}</span>
              <span className="muted">›</span>
            </button>
          ) : (
            <ListedAlert sku={sku} />
          )}
        </div>
        <a className="ghost line" href="#/">
          Back to Markets
        </a>
      </div>
    )

  if (!price)
    return (
      <div className="flow">
        {back}
        <Item name={data.s.name} note={cardSub(data.s.name)} />
        <p className="muted">Nobody is selling this card right now. Make an offer and a seller can accept it instantly.</p>
        <a className="btn wide" href={`#/offer/${sku}`}>
          Make an offer
        </a>
      </div>
    )

  if (cash !== undefined && cash < price && !flow.busy)
    return (
      <div className="flow">
        {back}
        <Item name={data.s.name} note={cardSub(data.s.name)} />
        <div className="quote" style={{ gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center' }}>
          <div>
            <span className="cap">Price</span>
            <div style={{ fontSize: 18, marginTop: 3 }}>{usd(price)}</div>
          </div>
          <div>
            <span className="cap">Cash</span>
            <div style={{ fontSize: 18, marginTop: 3 }}>{usd(cash)}</div>
          </div>
          <div>
            <span className="cap">Short</span>
            <div style={{ fontSize: 18, marginTop: 3, fontWeight: 500 }}>{usd(Math.ceil(price - cash))}</div>
          </div>
        </div>
        <p className="muted" style={{ lineHeight: '22px' }}>
          Add the difference, then come back and buy. Nothing happens until you confirm.
        </p>
        <a className="btn wide" href="#/you">
          {net.mintableQuote ? 'Add test dollars' : 'Add USDC'}
        </a>
        <Deposit address={account.address} />
        <button className="ghost line" onClick={refresh}>
          I’ve sent it. Check my cash
        </button>
        <a className="u" href={`#/offer/${sku}`} style={{ alignSelf: 'center', fontSize: 14, color: 'var(--ink-2)' }}>
          Or make an offer within your cash
        </a>
      </div>
    )

  const buy = async () => {
    if (!port) return
    setLocked(price)
    const cents = Math.round(price * 100)
    const amount = toUnits(price)
    const needFromExchange = port.cash * 100 < cents ? toUnits(price - port.cash) : 0n
    let tx: string | void = undefined
    const ok = await flow.run([
      ...confirmStep(account),
      ...(needFromExchange > 0n
        ? ([['Using your exchange cash', async () => (await send(account, { address: port.ma, abi: marginAbi, functionName: 'withdraw', args: [needFromExchange, net.quote] })).transactionHash]] as [string, () => Promise<string>][])
        : []),
      ['Authorizing payment', async () => (await send(account, { address: net.quote, abi: erc20Abi, functionName: 'approve', args: [data.s.market, amount] })).transactionHash],
      [
        'Buying, confirming on Monad',
        // Fill-or-kill at the agreed price: if someone takes it first, nothing is charged.
        async () => (tx = (await send(account, { address: data.s.market, abi: bookAbi, functionName: 'placeAndExecuteMarketBuy', args: [BigInt(cents), 0n, false, true] })).transactionHash),
      ],
    ])
    if (ok && tx) {
      logActivity(account.address, { text: `Bought ${cardTitle(data.s.name)}`, amount: -price })
      return void (location.hash = `#/done/${sku}/${price}/${tx}`)
    }
    refresh()
    // If the price we agreed to is gone, someone else was faster; say so instead of showing a raw error.
    const fresh = (await loadSkus()).find((x) => x.sku === sku)
    const top = fresh && hasMarket(fresh) ? decodeL2(await pub.readContract({ address: fresh.market, abi: bookAbi, functionName: 'getL2Book' })).asks : []
    if (!top.some((l) => l.price === price)) setMissed(true)
  }

  return (
    <div className="sheet-page">
      <div className="sheet-top">
        <Slab name={data.s.name} size="md" />
      </div>
      <div className="flow sheet">
      <i className="sheet-handle" aria-hidden />
      <Item name={data.s.name} note={cardSub(data.s.name)} />
      <div className="rows">
        <div className="kv">
          <span>Price</span>
          <span>{usd(price, 2)}</span>
        </div>
        <div className="kv">
          <span>Trading fee</span>
          <span>$0.00</span>
        </div>
        <div className="kv">
          <span>Network fee</span>
          <span>under $0.01</span>
        </div>
        <div className="kv total">
          <span>Total</span>
          <span className="big" style={{ fontSize: 32 }}>
            {usd(price, 2)}
          </span>
        </div>
      </div>
      <div className="kv panel" style={{ padding: '12px 14px' }}>
        <span>Cash</span>
        <span>
          {cash === undefined ? 'Checking…' : <>{usd(cash)} <span className="muted">→</span> {usd(cash - price)}</>}
        </span>
      </div>
      <p className="fine">You pay {usd(price)} or nothing. If someone buys it a moment before you, the order cancels and your cash stays put.</p>
      <button className="btn wide" disabled={flow.busy || !port} onClick={buy}>
        {flow.busy && <span className="spin" aria-hidden />}
        {flow.doing ?? (account.source === 'mera' ? `Pay ${usd(price)} with Face ID` : `Buy for ${usd(price)}`)}
      </button>
      <Steps steps={flow.steps} error={flow.error} />
      {!flow.busy && (
        <a className="u" href={`#/card/${sku}`} style={{ alignSelf: 'center', fontSize: 14, color: 'var(--ink-2)' }}>
          Not now
        </a>
      )}
      </div>
    </div>
  )
}

function BidAlert({ sku, paid }: { sku: string; paid: number }) {
  const al = useAlerts()
  const on = al.has(sku, 'bid')
  const [blocked, setBlocked] = useState(false)
  return (
    <div className="notice" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
      <span>{blocked ? 'Allow notifications in your browser first.' : 'Want a heads-up if someone offers more than you paid?'}</span>
      <button className={`pill ${on ? 'on' : ''}`} onClick={async () => (on ? al.off(sku, 'bid') : setBlocked(!(await al.on({ sku, kind: 'bid', price: paid }))))}>
        {on ? 'On' : 'Turn on'}
      </button>
    </div>
  )
}

export function Receipt({ sku, price, tx, account }: { sku: string; price: number; tx: string; account: LocalAccount }) {
  const { data } = usePoll(async () => (await loadSkus()).find((x) => x.sku === sku), 30000, [sku])
  const { data: port, totalCash } = usePortfolio(account.address)
  if (!data) return <div style={{ marginTop: 40 }}><Skeleton h={320} r={12} /></div>
  return (
    <div className="flow" style={{ paddingTop: 32 }}>
      <div className="rise" style={{ display: 'flex', justifyContent: 'center' }}>
        <Slab name={data.name} size="md" />
      </div>
      <div className="result">
        <h1 className="big">It’s yours.</h1>
        <p className="muted">
          {cardTitle(data.name)} · {cardSub(data.name)} · {usd(price)}
        </p>
      </div>
      <div className="rows">
        <div className="kv">
          <span>Paid</span>
          <span>{usd(price)} from Cash</span>
        </div>
        <div className="kv">
          <span>Cash left</span>
          <span>{port ? usd(totalCash) : '—'}</span>
        </div>
        <div className="kv">
          <span>Settled</span>
          <span>
            On Monad ·{' '}
            <a className="u" href={explorerTx(tx)} target="_blank" rel="noreferrer">
              record
            </a>
          </span>
        </div>
        <div className="kv">
          <span>The slab</span>
          <span>Stays in the vault until you ask</span>
        </div>
      </div>
      <BidAlert sku={sku} paid={price} />
      <div style={{ display: 'flex', gap: 10 }}>
        <a className="ghost line" href="#/" style={{ flex: '0 0 128px' }}>
          Markets
        </a>
        <a className="btn" href="#/collection" style={{ flex: 1 }}>
          See it in Collection
        </a>
      </div>
    </div>
  )
}

/** Sell (now, or at your price) and Make offer share one screen: a price, what it means, and an Undo. */
export function TradeFlow({ side, sku, account }: { side: 'sell' | 'offer'; sku: string; account: LocalAccount }) {
  const { data, refresh } = useCard(sku)
  const { data: port, refresh: refreshPort } = usePortfolio(account.address)
  const { data: hist } = usePoll(async () => (data ? tradeHistory(data.s.market) : undefined), 30000, [data?.s.market])
  const flow = useFlow()
  const [mode, setMode] = useState<'now' | 'list'>()
  const [price, setPrice] = useState<string>()
  const [placed, setPlaced] = useState<{ id: number; text: string }>()
  if (!data || !port)
    return (
      <>
        <Header back={`#/card/${sku}`} backLabel="Card" />
        <Skeleton h={320} r={12} />
      </>
    )
  const { s, ask, bid } = data
  const h = port.holdings.find((x) => x.s.sku === sku)
  const free = Number((h?.wallet ?? 0n) + (h?.onBook ?? 0n))
  const paid = lastPaid(hist?.fills ?? [], account.address)
  const sellNow = side === 'sell' && (mode ?? (bid ? 'now' : 'list')) === 'now' && !!bid
  const last = hist?.fills.at(-1)?.price
  const suggest = side === 'sell' ? (ask ?? last ?? (bid ? bid * 1.1 : 0)) : bid ? bid + step(bid) : ask ? ask * 0.9 : (last ?? 0)
  const px = Number(price ?? Math.round(suggest))
  const valid = Number.isFinite(px) && px >= 1 && px < 4e7
  // Post-only orders must not cross the book: a listing at or under the top offer is just "Sell now".
  const crosses = side === 'sell' ? !!bid && px <= bid : !!ask && px >= ask
  const exCash = port.exCash
  const short = side === 'offer' && valid && px > port.cash + exCash
  const get = sellNow ? bid! : px
  const bump = (d: number) => setPrice(String(Math.max(1, Math.round(px + d * step(px)))))

  const submit = async () => {
    const ma = await marginAccount()
    const steps: [string, () => Promise<string | void>][] = []
    if (sellNow) {
      if ((h?.wallet ?? 0n) < 1n) steps.push(['Bringing your card off the exchange', async () => (await send(account, { address: ma, abi: marginAbi, functionName: 'withdraw', args: [1n, s.token] })).transactionHash])
      steps.push(['Authorizing the sale', async () => (await send(account, { address: s.token, abi: erc20Abi, functionName: 'approve', args: [s.market, 1n] })).transactionHash])
      steps.push([
        `Selling for ${usd(bid)}`,
        // Fill-or-kill with a floor at the shown offer: it sells at that price or not at all.
        async () => (await send(account, { address: s.market, abi: bookAbi, functionName: 'placeAndExecuteMarketSell', args: [1n, toUnits(bid!), false, true] })).transactionHash,
      ])
      if (await flow.run(steps)) {
        logActivity(account.address, { text: `Sold ${cardTitle(s.name)}`, amount: bid })
        setPlaced({ id: 0, text: `Sold for ${usd(bid)}. Cash is in your account.` })
      }
    } else {
      const cents = Math.round(px * 100)
      const [token, need, have] = side === 'sell' ? [s.token, 1n, h?.onBook ?? 0n] : [net.quote, toUnits(px), toUnits(exCash)]
      // Cards or cash already free on the exchange (cancelled orders, filled offers) are used first.
      const amount = need > have ? need - have : 0n
      if (amount > 0n)
        steps.push(
          ['Authorizing', async () => (await send(account, { address: token, abi: erc20Abi, functionName: 'approve', args: [ma, amount] })).transactionHash],
          [side === 'sell' ? 'Moving your card to the exchange' : 'Setting aside your cash', async () => (await send(account, { address: ma, abi: marginAbi, functionName: 'deposit', args: [account.address, token, amount] })).transactionHash],
        )
      let id = 0
      steps.push([
        side === 'sell' ? `Listing for ${usd(px)}` : `Offering ${usd(px)}`,
        async () => {
          const r = await send(account, { address: s.market, abi: bookAbi, functionName: side === 'sell' ? 'addSellOrder' : 'addBuyOrder', args: [cents, 1n, true] })
          id = Number(parseEventLogs({ abi: bookAbi, eventName: 'OrderCreated', logs: r.logs })[0]?.args.orderId ?? 0)
          return r.transactionHash
        },
      ])
      if (await flow.run(steps)) {
        logActivity(account.address, { text: `${side === 'sell' ? 'Listed' : 'Offered on'} ${cardTitle(s.name)}`, amount: px, wait: true })
        setPlaced({ id, text: side === 'sell' ? `Listed for ${usd(px)}.` : `Offer of ${usd(px)} placed.` })
      }
    }
    refresh()
    refreshPort()
  }
  const undo = async () => {
    if (!placed?.id) return
    const id = placed.id
    setPlaced(undefined)
    if (await flow.run([['Cancelled', async () => (await send(account, { address: s.market, abi: bookAbi, functionName: 'batchCancelOrders', args: [[id]] })).transactionHash]])) refresh()
  }

  if (side === 'sell' && free < 1 && !placed)
    return (
      <div className="flow">
        <Header back={`#/card/${sku}`} backLabel="Card" title="Sell" />
        <Item name={s.name} note={cardSub(s.name)} />
        <p className="muted">{h?.listed ? 'Your copy is already listed. Change or cancel it on the card page.' : 'You don’t own this card yet.'}</p>
        <a className="btn wide" href={`#/card/${sku}`}>
          Back to the card
        </a>
      </div>
    )

  return (
    <div className="flow">
      <Header back={`#/card/${sku}`} backLabel="Cancel" title={side === 'sell' ? 'Sell' : 'Make an offer'} />
      <Item name={s.name} note={side === 'sell' ? `${cardSub(s.name)}${paid ? ` · you paid ${usd(paid)}` : ''}` : `${cardSub(s.name)} · ${ask ? `buy now ${usd(ask)}` : 'no sellers yet'}`} />

      {side === 'sell' && (
        <div role="radiogroup" aria-label="How to sell" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className={`opt ${sellNow ? 'on' : ''}`} role="radio" aria-checked={sellNow} disabled={!bid} onClick={() => setMode('now')}>
            <span>
              <b>Sell now</b>
              <small>{bid ? 'To the top offer. Cash in about a second.' : 'No offers yet.'}</small>
            </span>
            <em>{bid ? usd(bid) : '—'}</em>
          </button>
          <button className={`opt ${!sellNow ? 'on' : ''}`} role="radio" aria-checked={!sellNow} onClick={() => setMode('list')}>
            <span>
              <b>Set your price</b>
              <small>Waits for a buyer. Change or cancel anytime.</small>
            </span>
            <em>{valid ? usd(px) : '—'}</em>
          </button>
        </div>
      )}

      {!sellNow && (
        <div>
          <div className="stepper">
            <button aria-label="Lower" onClick={() => bump(-1)}>
              −
            </button>
            <label style={{ flex: 1, minWidth: 0 }}>
              <span className="cap" style={{ display: 'block', textAlign: 'center' }}>
                {side === 'sell' ? 'Your price' : 'Your offer'}
              </span>
              <input inputMode="decimal" aria-label={side === 'sell' ? 'Your price in dollars' : 'Your offer in dollars'} value={'$' + Number(price ?? Math.round(suggest)).toLocaleString('en-US')} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))} />
            </label>
            <button aria-label="Raise" onClick={() => bump(1)}>
              +
            </button>
          </div>
          <p className="fine" role="status" style={{ textAlign: 'center', marginTop: 6 }}>
            {crosses
              ? side === 'sell'
                ? `That’s at or under the top offer. Choose Sell now to get ${usd(bid)} instantly.`
                : `That’s at or over the asking price. Buy now for ${usd(ask)} instead.`
              : side === 'sell'
                ? !ask
                  ? 'You would be the only seller.'
                  : px < ask
                    ? 'Lowest price listed. Buyers see it first.'
                    : 'Above the current lowest price.'
                : bid && px > bid
                  ? 'Highest offer on the market.'
                  : 'Below the current top offer.'}
          </p>
        </div>
      )}

      <div className="rows">
        <div className="kv">
          <span>Trading fee</span>
          <span>$0.00</span>
        </div>
        <div className="kv">
          <span>{side === 'sell' ? 'You get' : 'You pay if accepted'}</span>
          <span style={{ fontWeight: 500 }}>{valid ? usd(get) : '—'}</span>
        </div>
        {side === 'sell' && paid !== undefined && valid && (
          <div className="kv">
            <span>Compared with what you paid</span>
            <span className={get - paid >= 0 ? 'up' : 'down'}>{delta(get - paid)}</span>
          </div>
        )}
        {side === 'offer' && (
          <div className="kv">
            <span>Cash</span>
            <span>{usd(port.cash + exCash)}</span>
          </div>
        )}
      </div>

      <Steps steps={flow.steps} error={flow.error} />
      {placed ? (
        <a className="btn wide" href={`#/card/${sku}`}>
          Back to the card
        </a>
      ) : (
      <button className="btn wide" disabled={flow.busy || (!sellNow && (!valid || crosses)) || short} onClick={submit}>
        {flow.busy && <span className="spin" aria-hidden />}
        {flow.doing ?? (short ? 'Not enough cash' : sellNow ? `Sell now for ${usd(bid)}` : side === 'sell' ? `List for ${valid ? usd(px) : ''}` : `Offer ${valid ? usd(px) : ''}`)}
      </button>
      )}
      <p className="fine" style={{ textAlign: 'center' }}>
        {side === 'sell' ? 'Cancel anytime. Cash lands the moment it sells.' : 'Your offer holds that cash until it fills or you cancel.'}
      </p>
      {placed && <Toast text={placed.text} action={placed.id ? 'Undo' : 'Collection'} onAction={placed.id ? undo : () => (location.hash = '#/collection')} />}
    </div>
  )
}

const step = (p: number) => (p >= 10000 ? 250 : p >= 1000 ? 50 : p >= 100 ? 5 : 1)
