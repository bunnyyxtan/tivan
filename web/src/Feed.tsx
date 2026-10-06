import { foundingCollectors, recentFills, type Founder } from './chain'
import { Slab, cardTitle, short, usePoll, usd } from './ui'

const ago = (t: number) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - t))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

/** Live trades across every card. The social heartbeat of the market; needs the indexer, so it hides when empty. */
export function ActivityFeed({ me }: { me?: string }) {
  const { data } = usePoll(() => recentFills(12), 8000, [])
  if (!data || !data.length) return null
  return (
    <section className="section">
      <span className="cap">Live activity</span>
      <div className="rows">
        {data.map((f, i) => (
          <a key={i} className="feed-row" href={`#/card/${f.sku}`}>
            <Slab name={f.name} size="xs" />
            <span className="feed-info">
              <span>
                <b>{f.taker === me?.toLowerCase() ? 'You' : short(f.taker)}</b> {f.takerBuy ? 'bought' : 'sold'} {cardTitle(f.name)}
              </span>
              <span className="muted">{ago(f.t)}</span>
            </span>
            <span className="feed-px">{usd(f.price)}</span>
          </a>
        ))}
      </div>
    </section>
  )
}

/** The first collectors to post a price on a card: an onchain record of who opened its market. */
export function FoundingCollectors({ market, me }: { market: `0x${string}`; me?: string }) {
  const { data } = usePoll(() => foundingCollectors(market, 5), 20000, [market])
  if (!data || !data.length) return null
  return (
    <section className="section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span className="cap">Founding collectors</span>
        <span className="fine">First to price this card</span>
      </div>
      <div className="founders">
        {data.map((f: Founder, i) => (
          <span key={i} className={`founder ${f.owner === me?.toLowerCase() ? 'me' : ''}`}>
            <span className="founder-rank">{i + 1}</span>
            {f.owner === me?.toLowerCase() ? 'You' : short(f.owner)}
          </span>
        ))}
      </div>
      <p className="fine" style={{ marginTop: 8 }}>
        On a 0% market, whoever posts a price keeps the whole spread a platform would take. These wallets opened this market.
      </p>
    </section>
  )
}
