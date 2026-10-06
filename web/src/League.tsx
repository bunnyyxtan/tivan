import { useState } from 'react'
import type { LocalAccount } from 'viem'
import { leaderboard } from './chain'
import { brand } from './config'
import { Header, short, usePoll } from './ui'

/** The Tivan Price League: trade real card markets on testnet, found markets, climb the board. */
export function League({ account }: { account?: LocalAccount }) {
  const { data, error } = usePoll(leaderboard, 15000, [])
  const [copied, setCopied] = useState(false)
  const me = account?.address.toLowerCase()
  const mine = data?.findIndex((t) => t.addr === me) ?? -1
  const invite = `${location.origin}${location.pathname}#/league`
  const copy = () => {
    navigator.clipboard?.writeText(`Trade graded cards on Monad testnet with ${brand}. Free test dollars, real order books: ${invite}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }
  return (
    <>
      <Header title="League" />
      <section className="rise">
        <h2 className="big" style={{ fontSize: 30 }}>
          The {brand} Price League
        </h2>
        <p className="muted" style={{ marginTop: 8, lineHeight: '22px' }}>
          Price real graded cards on testnet. Trade to earn a point, and be the first to price a card to found its market for two. Test dollars are free.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <a className="btn" href="#/" style={{ flex: 1 }}>
            Start trading
          </a>
          <button className="ghost line" onClick={copy} style={{ flex: '0 0 auto' }}>
            {copied ? 'Copied' : 'Invite a friend'}
          </button>
        </div>
      </section>

      <section className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span className="cap">Standings</span>
          {mine >= 0 && <span className="fine">You are #{mine + 1}</span>}
        </div>
        {!data && !error && [0, 1, 2].map((i) => <div key={i} className="skeleton" />)}
        {data && !data.length && <div className="empty">No trades yet. Be the first on the board.</div>}
        <div className="rows">
          {data?.slice(0, 20).map((t, i) => (
            <div key={t.addr} className={`kv board-row ${t.addr === me ? 'me' : ''}`} style={{ alignItems: 'center' }}>
              <span style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--tx)' }}>
                <span className="board-rank">{i + 1}</span>
                {t.addr === me ? 'You' : short(t.addr)}
              </span>
              <span style={{ textAlign: 'right' }}>
                <b style={{ fontWeight: 600 }}>{t.score}</b> <span className="muted">pts</span>
                <span className="fine" style={{ display: 'block' }}>
                  {t.trades} trades · {t.founded} founded
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="fine" style={{ marginTop: 10 }}>
          Read live from the onchain indexer. Test dollars only; no prizes are promised.
        </p>
      </section>
    </>
  )
}
