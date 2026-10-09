import { useEffect, useRef, useState, type ReactNode } from 'react'
import { brand, catalog, catalogOf, net } from './config'
import { explorerAddress, loadSkus, pub, readBook, type FeedItem, type Sku } from './chain'
import { cents, usdC } from './cardParts'
import { confetti, still } from './celebrate'
import { ago, useSales } from './desk'
import { aggregate } from './logic/orders.ts'
import { formatBps, formatQty } from './logic/money.ts'
import { openPalette } from './Palette'
import { IconChevron, IconKeystone, IconSearch } from './icons'
import { Slab, cardTitle, parseName, usePoll } from './ui'

// The public front door, shown at the site root to visitors. A poster-style hero over a moving wall of cards, a tape of
// recent trades, a popular-markets carousel, an order book read from chain, crossing marquee ribbons, a popular-cards
// grid, a pull-a-card toy, a call to action and a footer. Every name, price, block and trade is real data; nothing is
// invented, and nothing is called live that is not.

const PSA: Record<string, string> = { '10': 'Gem Mint', '9': 'Mint', '8': 'NM-MT', '7': 'Near Mint', '6': 'EX-MT', '5': 'Excellent', '4': 'VG-EX', '3': 'Very Good', '2': 'Good', '1': 'Poor' }
const gradeLabel = (name: string) => `${parseName(name).grader} ${parseName(name).grade} · ${PSA[parseName(name).grade] ?? ''}`.trim()
const price = (s: Sku) => (s.ask ? usdC(cents(s.ask)) : s.last ? usdC(cents(s.last)) : 'No ask')

/** Pointer tilt with a moving holographic shine. Off on touch screens and when motion is reduced. */
function Holo({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || still() || matchMedia('(hover: none)').matches) return
    let raf = 0
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        el.style.setProperty('--mx', `${x * 100}%`)
        el.style.setProperty('--my', `${y * 100}%`)
        el.style.setProperty('--rx', `${(0.5 - y) * 18}deg`)
        el.style.setProperty('--ry', `${(x - 0.5) * 22}deg`)
        el.classList.add('tilting')
      })
    }
    const leave = () => {
      cancelAnimationFrame(raf)
      el.classList.remove('tilting')
      for (const p of ['--mx', '--my', '--rx', '--ry']) el.style.removeProperty(p)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    return () => (cancelAnimationFrame(raf), el.removeEventListener('pointermove', move), el.removeEventListener('pointerleave', leave))
  }, [])
  return (
    <span ref={ref} className={`lp-holo ${className}`}>
      {children}
      <i className="lp-shine" aria-hidden />
    </span>
  )
}

/** The chain's latest block, read every few seconds. */
function useBlock() {
  const [b, setB] = useState<bigint>()
  useEffect(() => {
    let live = true
    const read = () => pub.getBlockNumber().then((x) => live && setB(x), () => {})
    read()
    const id = setInterval(read, 3000)
    return () => ((live = false), clearInterval(id))
  }, [])
  return b
}

/** Columns of card art drifting up and down on a tilted plane. Decorative; the pictures are reference art. */
function Wall({ cols = 6 }: { cols?: number }) {
  const imgs = catalog.map((c) => c.imageUrl)
  return (
    <div className="lp-wall" aria-hidden>
      <div className="lp-wall-plane">
        {Array.from({ length: cols }, (_, c) => {
          const col = [...imgs.slice((c * 5) % imgs.length), ...imgs].slice(0, 6)
          return (
            <div key={c} className="lp-col">
              <div className="lp-col-run">
                {[...col, ...col].map((src, k) => (
                  <img key={k} src={src} alt="" loading="lazy" decoding="async" />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type Chip = { key: string; name: string; label: string; amount: string; when?: string }
/** The latest real trades as chips floating around the hero card; asks when the trade feed is unavailable. */
function liveChips(fills: FeedItem[] | undefined, all: Sku[]): Chip[] {
  const seen = new Set<string>()
  const out: Chip[] = []
  for (const f of fills ?? []) {
    const k = f.sku.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ key: `${k}-${f.t}`, name: f.name, label: 'Last sale', amount: usdC(cents(f.price)), when: ago(f.t) })
  }
  if (!out.length) for (const s of all.filter((x) => x.ask)) out.push({ key: s.sku, name: s.name, label: 'Lowest ask', amount: price(s) })
  return out
}

function Chips({ items }: { items: Chip[] }) {
  const [k, setK] = useState(0)
  useEffect(() => {
    if (items.length < 4 || still()) return
    const id = setInterval(() => setK((x) => x + 1), 4200)
    return () => clearInterval(id)
  }, [items.length])
  if (!items.length) return null
  return (
    <>
      {[0, 1, 2].map((slot) => {
        const c = items[(k + slot) % items.length]
        if (slot >= items.length) return null
        return (
          <span key={`${slot}-${c.key}`} className={`lp-chip c${slot}`}>
            <Slab name={c.name} size="xs" />
            <span>
              <small>{c.label}{c.when ? ` · ${c.when}` : ''}</small>
              <b>{c.amount}</b>
              <em>{cardTitle(c.name)} · {parseName(c.name).grader} {parseName(c.name).grade}</em>
            </span>
          </span>
        )
      })}
    </>
  )
}

function Hero({ list, all, fills }: { list: Sku[]; all: Sku[]; fills?: FeedItem[] }) {
  const [i, setI] = useState(0)
  const block = useBlock()
  const n = list.length
  const go = (d: number) => n && setI((x) => (x + d + n) % n)
  const at = (k: number) => list[(i + k + n) % n]
  const s = n ? at(0) : undefined
  const vaulted = all.reduce((t, x) => t + x.vaulted, 0)
  return (
    <section className="lp-hero" aria-label={brand}>
      <div className="lp-aurora" aria-hidden><i /><i /><i /></div>
      <Wall />
      <div className="lp-hero-in">
        <div className="lp-hero-copy">
          <p className="lp-kicker"><span className="lp-dot" aria-hidden />{all.length ? `${all.length} markets on ${net.chain.name}` : `On ${net.chain.name}`}</p>
          <h1 className="lp-poster">
            <span className="ln">Trade graded</span>
            <span className="ln">cards on a real</span>
            <span className="ln">exchange<span className="lp-bang">!</span></span>
          </h1>
          <p className="lp-sub">
            <span className="lp-words" aria-hidden>
              <span>Chase grails!</span>
              <span>Name your price!</span>
              <span>Sell in a tap!</span>
              <span>Chase grails!</span>
            </span>
            <span className="sr-only">Chase grails, name your price, sell in a tap.</span>
          </p>
          <p className="lp-lead">Every slab sits in a vault with its own order book. Buy at the ask, name your price, or sell in a tap. Trades settle on {net.chain.name} in about a second.</p>
          <div className="lp-cta">
            <a className="lp-btn" href="#/markets">Browse markets</a>
            <a className="lp-btn ghost" href="#/sell">Sell a card</a>
          </div>
          <dl className="lp-stats">
            <div><dt>Markets</dt><dd>{all.length || '—'}</dd></div>
            <div><dt>Cards in the vault</dt><dd>{all.length ? formatQty(BigInt(vaulted)) : '—'}</dd></div>
            <div><dt>Latest block</dt><dd key={String(block)} className="tick">{block ? block.toLocaleString('en-US') : '—'}</dd></div>
          </dl>
        </div>
        <div className="lp-hero-art">
          {s && (
            <div className="lp-stage" aria-live="polite">
              <span className="lp-ring" aria-hidden />
              <span className="lp-back b1" aria-hidden><Slab name={at(1).name} size="lg" /></span>
              <span className="lp-back b2" aria-hidden><Slab name={at(-1).name} size="lg" /></span>
              <a key={s.sku} className="lp-front" href={`#/card/${s.sku}`} aria-label={`${cardTitle(s.name)}, ${gradeLabel(s.name)}, ${price(s)}`}>
                <Holo><Slab name={s.name} size="xl" /></Holo>
              </a>
              <span className="lp-spark" aria-hidden>✦</span>
              <span className="lp-spark s2" aria-hidden>✦</span>
              <span className="lp-tag"><b>{price(s)}</b>{cardTitle(s.name)} · {gradeLabel(s.name)}</span>
              <Chips items={liveChips(fills, all)} />
            </div>
          )}
          {n > 1 && (
            <div className="lp-pager">
              <button className="lp-arrow prev" onClick={() => go(-1)} aria-label="Previous card"><IconChevron /></button>
              <div className="lp-dots" role="tablist" aria-label="Featured cards">
                {list.map((x, k) => <button key={x.sku} role="tab" aria-selected={k === i} aria-label={cardTitle(x.name)} onClick={() => setI(k)} />)}
              </div>
              <button className="lp-arrow next" onClick={() => go(1)} aria-label="Next card"><IconChevron /></button>
            </div>
          )}
        </div>
      </div>
      <span className="lp-scroll" aria-hidden />
    </section>
  )
}

/** A running tape of the latest trades, or of asks when the trade feed is unavailable. */
function Ticker({ fills, all }: { fills?: FeedItem[]; all: Sku[] }) {
  const items = fills?.length
    ? fills.slice(0, 18).map((f, k) => ({ k: `${f.sku}-${f.t}-${k}`, name: f.name, side: f.takerBuy ? 'Bought' : 'Sold', up: f.takerBuy, amount: usdC(cents(f.price)), when: ago(f.t) }))
    : all.filter((s) => s.ask).map((s) => ({ k: s.sku, name: s.name, side: 'Ask', up: true, amount: price(s), when: '' }))
  if (!items.length) return null
  const run = items.map((x) => (
    <span key={x.k} className="lp-tk">
      <i className={x.up ? 'up' : 'down'} aria-hidden>{x.up ? '▲' : '▼'}</i>
      <b>{cardTitle(x.name)}</b>
      <em>{parseName(x.name).grader} {parseName(x.name).grade}</em>
      <span>{x.side} {x.amount}</span>
      {x.when && <small>{x.when}</small>}
    </span>
  ))
  return (
    <div className="lp-ticker" role="region" aria-label={fills?.length ? 'Latest trades' : 'Lowest asks'}>
      <span className="lp-ticker-tag">{fills?.length ? 'Recent trades' : 'Lowest asks'}<small>Test network</small></span>
      <div className="lp-ticker-view">
        <div className="lp-ticker-run">{run}<span aria-hidden className="lp-tk-dup">{run}</span></div>
      </div>
    </div>
  )
}

function Heading({ children, light }: { children: string; light?: boolean }) {
  return (
    <h2 className={`lp-h lp-rv ${light ? 'on-dark' : ''}`}>
      <span className="lp-h-mark" aria-hidden />
      {children}
    </h2>
  )
}

function Popular({ list }: { list: Sku[] }) {
  const track = useRef<HTMLDivElement>(null)
  const [mid, setMid] = useState(1)
  const step = (d: number) => {
    const el = track.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('.lp-pop')
    el.scrollBy({ left: d * ((card?.offsetWidth ?? 220) + 20), behavior: 'smooth' })
  }
  // The card nearest the centre of the track is lifted, like the reference's highlighted pack.
  useEffect(() => {
    const el = track.current
    if (!el) return
    const pick = () => {
      const c = el.scrollLeft + el.clientWidth / 2
      const cards = [...el.querySelectorAll<HTMLElement>('.lp-pop')]
      let best = 0
      cards.forEach((x, k) => Math.abs(x.offsetLeft + x.offsetWidth / 2 - c) < Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - c) && (best = k))
      setMid(best)
    }
    pick()
    el.addEventListener('scroll', pick, { passive: true })
    addEventListener('resize', pick)
    return () => (el.removeEventListener('scroll', pick), removeEventListener('resize', pick))
  }, [list.length])
  return (
    <section className="lp-sec lp-light lp-pop-sec" aria-label="Popular markets">
      <span className="lp-blob a" aria-hidden />
      <span className="lp-blob b" aria-hidden />
      <div className="lp-wrap wide">
        <Heading>Popular markets</Heading>
        <div className="lp-carousel">
          <button className="lp-arrow in prev" onClick={() => step(-1)} aria-label="Scroll back"><IconChevron /></button>
          <div className="lp-track" ref={track} tabIndex={0} aria-label="Popular markets">
            {list.map((s, k) => (
              <a key={s.sku} className={`lp-pop ${k === mid ? 'on' : ''}`} href={`#/card/${s.sku}`}>
                <span className="lp-pop-art"><Slab name={s.name} size="md" /></span>
                <b>{cardTitle(s.name)}</b>
                <small>{gradeLabel(s.name)}</small>
                <span className="lp-pop-price">{price(s)}</span>
                <span className="lp-mini">View market</span>
              </a>
            ))}
          </div>
          <button className="lp-arrow in next" onClick={() => step(1)} aria-label="Scroll on"><IconChevron /></button>
        </div>
      </div>
    </section>
  )
}

/** One market's real order book, read from its contract every few seconds. Rows that change flash. */
function Exchange({ list }: { list: Sku[] }) {
  const [pick, setPick] = useState(0)
  const s = list[Math.min(pick, list.length - 1)]
  const block = useBlock()
  const { data, error } = usePoll(async () => (s ? { m: s.market, book: await readBook(s.market) } : undefined), 6000, [s?.market])
  const book = data && s && data.m === s.market ? data.book : undefined
  const asks = book ? aggregate(book.asks, 'ask').slice(0, 5) : []
  const bids = book ? aggregate(book.bids, 'bid').slice(0, 5) : []
  const ask = asks[0]
  const bid = bids[0]
  const gap = ask && bid ? ask.price - bid.price : undefined
  const c = s ? catalogOf(s.name) : undefined
  const steps: [string, string][] = [
    ['Graded and vaulted', `Each slab is checked against its grader's certificate and held in custody. One token stands for one slab.${net.name === 'testnet' ? ' On this test network the check and custody are simulated.' : ''}`],
    ['Its own order book', 'Every card and grade trades on its own Kuru order book. Every bid and ask is on chain, where anyone can read it.'],
    ['Settles in about a second', `Buy at the ask, sell to the best offer, or name your price. Trades settle on ${net.chain.name}, and the token is yours to keep or withdraw.`],
  ]
  const ladder = (rows: typeof asks, side: 'bid' | 'ask') =>
    Array.from({ length: 5 }, (_, k) => {
      const r = rows[k]
      return r ? (
        <div key={`${side}${r.price}-${r.size}`} className={`lp-lv ${side}`}>
          <i style={{ width: `${Number(r.depthBps) / 100}%` }} />
          <span>{usdC(r.price, 2)}</span>
          <span>{formatQty(r.size)}</span>
        </div>
      ) : (
        <div key={`${side}e${k}`} className={`lp-lv ${side} empty`} aria-hidden>
          <span>—</span>
          <span />
        </div>
      )
    })
  return (
    <section className="lp-sec lp-dark lp-ex" aria-label="How it works">
      <div className="lp-grid-bg" aria-hidden />
      <div className="lp-wrap wide lp-ex-in">
        <div className="lp-ex-copy">
          <p className="lp-eyebrow">How it works</p>
          <h2 className="lp-poster md lp-rv">A real order book<br />for every slab</h2>
          <p className="lp-ex-lead">Not a listing and not an auction. Each card and grade is its own market, where buyers and sellers meet at a price, like a stock.</p>
          <ol className="lp-steps">
            {steps.map(([t, d], k) => (
              <li key={t} className="lp-rv">
                <span className="lp-step-n">{k + 1}</span>
                <div><b>{t}</b><p>{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <div className="lp-term lp-rv">
          {list.length > 1 && (
            <div className="lp-term-tabs" role="tablist" aria-label="Market">
              {list.map((x, k) => (
                <button key={x.sku} role="tab" aria-selected={x === s} onClick={() => setPick(k)}>
                  <Slab name={x.name} size="xs" />
                  <span><b>{cardTitle(x.name)}</b><small>{parseName(x.name).grader} {parseName(x.name).grade}</small></span>
                </button>
              ))}
            </div>
          )}
          <div className="lp-term-body">
            <div className="lp-term-art">{s && <Holo><Slab name={s.name} size="lg" /></Holo>}</div>
            <div className="lp-term-main">
              <div className="lp-term-title">
                <small>{c ? `${c.category} · ${c.set}` : 'Market'}</small>
                <b>{s ? cardTitle(s.name) : 'Loading markets'}</b>
                <span>{s ? gradeLabel(s.name) : ''}</span>
              </div>
              <div className="lp-quotes">
                <div className="lp-q bid">
                  <small>Sell now</small>
                  <b>{bid ? usdC(bid.price, 2) : '—'}</b>
                  <em>{bid ? `Best offer · ${formatQty(bid.size)} wanted` : 'No offers yet'}</em>
                </div>
                <div className="lp-q ask">
                  <small>Buy now</small>
                  <b>{ask ? usdC(ask.price, 2) : '—'}</b>
                  <em>{ask ? `Lowest ask · ${formatQty(ask.size)} for sale` : 'No one selling yet'}</em>
                </div>
              </div>
              <div className="lp-gap">
                <span>Spread</span>
                <i aria-hidden />
                <b>{gap !== undefined && ask ? `${usdC(gap, 2)} · ${formatBps((gap * 10_000n) / ask.price)}` : '—'}</b>
              </div>
              <div className="lp-depth">
                <div className="lp-depth-col">
                  <div className="lp-depth-h"><span>Offers</span><span>Cards</span></div>
                  {book ? ladder(bids, 'bid') : <p className="lp-ladder-note">{error ? 'The order book is not answering right now.' : 'Reading the order book…'}</p>}
                </div>
                <div className="lp-depth-col">
                  <div className="lp-depth-h"><span>Asks</span><span>Cards</span></div>
                  {book ? ladder(asks, 'ask') : null}
                </div>
              </div>
            </div>
          </div>
          <div className="lp-term-foot">
            <span>Read from the order book contract{block ? ` at block ${block.toLocaleString('en-US')}` : ''}. Refreshes every 6 seconds.</span>
            {s && <a href={`#/card/${s.sku}`}>Trade this card <IconChevron /></a>}
          </div>
        </div>
      </div>
    </section>
  )
}

function Marquee() {
  const words = `${brand.toUpperCase()} • GRADED • VAULTED • SETTLES ON MONAD • REAL ORDER BOOKS • `
  const row = (cls: string) => (
    <div className={`lp-ribbon ${cls}`} aria-hidden>
      <div className="lp-ribbon-run">{Array.from({ length: 6 }, (_, k) => <span key={k}>{words}</span>)}</div>
    </div>
  )
  return (
    <div className="lp-marquee">
      {row('a')}
      {row('b')}
    </div>
  )
}

function Cards({ list }: { list: Sku[] }) {
  return (
    <section className="lp-sec lp-light" aria-label="Popular cards">
      <div className="lp-wrap wide">
        <Heading>Popular cards</Heading>
        <div className="lp-grid">
          {list.map((s, k) => (
            <a key={s.sku} className="lp-card lp-rv" style={{ animationDelay: `${(k % 4) * 60}ms` }} href={`#/card/${s.sku}`}>
              <span className="lp-card-art"><Holo><Slab name={s.name} size="md" /></Holo></span>
              <b>{gradeLabel(s.name).split(' · ')[1] || parseName(s.name).grade}</b>
              <small>{cardTitle(s.name)}</small>
              <span className="lp-card-price">{price(s)}</span>
              <span className="lp-mini">Buy now</span>
            </a>
          ))}
        </div>
        <div className="lp-center"><a className="lp-btn outline" href="#/browse">View all cards</a></div>
      </div>
    </section>
  )
}

/** A toy: shuffle, flip and reveal a random live market. Nothing is bought. */
function Pull({ list }: { list: Sku[] }) {
  const [phase, setPhase] = useState<'idle' | 'shuffle' | 'shown'>('idle')
  const [s, setS] = useState<Sku>()
  const timer = useRef(0)
  useEffect(() => () => clearTimeout(timer.current), [])
  const pull = () => {
    if (!list.length || phase === 'shuffle') return
    const pool = list.length > 1 ? list.filter((x) => x !== s) : list
    const next = pool[Math.floor(Math.random() * pool.length)]
    setPhase('shuffle')
    timer.current = window.setTimeout(() => (setS(next), setPhase('shown'), confetti()), still() ? 0 : 1100)
  }
  return (
    <section className="lp-pull" aria-label="Pull a card">
      <div className="lp-pull-burst" aria-hidden />
      <div className="lp-wrap wide lp-pull-in">
        <div className={`lp-pull-art ${phase}`}>
          <span className="lp-deck d1" aria-hidden />
          <span className="lp-deck d2" aria-hidden />
          <Holo className="lp-flip-holo">
            <span className="lp-flip">
              <span className="lp-face front" aria-hidden>
                <span className="lp-cardback"><b>{brand}</b><small>Graded · Vaulted</small></span>
              </span>
              <span className="lp-face back">{s && <Slab name={s.name} size="lg" />}</span>
            </span>
          </Holo>
        </div>
        <div className="lp-pull-copy">
          <h2 className="lp-poster md lp-rv">Pull a random grail<span className="lp-bang">!</span></h2>
          <p>Shuffle the live markets and see what comes out. Every card here is a real market you can trade.</p>
          <div className="lp-pull-result" aria-live="polite">
            {phase === 'shown' && s ? (
              <>
                <small>You pulled</small>
                <b>{cardTitle(s.name)}</b>
                <span>{gradeLabel(s.name)} · <strong>{price(s)}</strong></span>
              </>
            ) : (
              <small>{phase === 'shuffle' ? 'Shuffling…' : 'Your card shows up here.'}</small>
            )}
          </div>
          <div className="lp-cta">
            <button className="lp-btn dark" onClick={pull} disabled={!list.length || phase === 'shuffle'}>{phase === 'shown' ? 'Pull again' : 'Pull a card'}</button>
            {phase === 'shown' && s && <a className="lp-btn ghost-dark" href={`#/card/${s.sku}`}>View market</a>}
          </div>
          <p className="lp-pull-fine">A random pick from the live markets, just for fun. Nothing is bought until you review and confirm a trade.</p>
        </div>
      </div>
    </section>
  )
}

function Cta({ a, b, c }: { a?: Sku; b?: Sku; c?: Sku }) {
  return (
    <section className="lp-cta-band" aria-label="Get started">
      <Wall cols={11} />
      <div className="lp-wrap wide lp-cta-in">
        <div className="lp-float" aria-hidden>
          {a && <span className="f1"><Slab name={a.name} size="lg" /></span>}
          {b && <span className="f2"><Slab name={b.name} size="lg" /></span>}
        </div>
        <div className="lp-cta-copy">
          <h2 className="lp-poster md lp-rv">Ready to own your first grail?</h2>
          <p>Sign in with a passkey. No seed phrase, no extension, and browsing never needs an account.</p>
          <div className="lp-cta">
            <a className="lp-btn" href="#/markets">Get your first card</a>
            <a className="lp-btn ghost" href="#/help">How it works</a>
          </div>
        </div>
      </div>
      {c && <span className="lp-peek" aria-hidden><Slab name={c.name} size="lg" /></span>}
    </section>
  )
}

function Footer() {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap wide lp-foot-in">
        <div>
          <span className="lp-brand">{brand}</span>
          <p>Graded trading cards held in a vault, each with its own on-chain order book.</p>
        </div>
        <nav aria-label="Quick links">
          <h3>Quick links</h3>
          <a href="#/markets">Markets</a>
          <a href="#/browse">Browse</a>
          <a href="#/sell">Sell a card</a>
          <a href="#/help">Help center</a>
          <a href="#/help?s=fees">Fees</a>
          <a href="#/help?s=custody">Custody and verification</a>
        </nav>
        <div>
          <h3>Built on Monad</h3>
          <p>Running on {net.chain.name}. Orders and trades are on-chain transactions you can look up.</p>
          {net.vault && <a className="lp-link" href={explorerAddress(net.vault)} target="_blank" rel="noreferrer">Vault contract on the explorer</a>}
          {net.name === 'testnet' && <p className="lp-fine">Test network: prices come from an automated market maker; cash and custody are simulated and have no value.</p>}
        </div>
      </div>
      <div className="lp-foot-word" aria-hidden>{brand}</div>
    </footer>
  )
}

export function Landing({ signedIn = false }: { signedIn?: boolean }) {
  const { data } = usePoll(loadSkus, 15000, [])
  const sales = useSales()
  const all = data ?? []
  const byAsk = [...all].filter((s) => s.ask).sort((a, b) => b.ask! - a.ask!)
  const count = new Map<string, number>()
  for (const f of sales.fills ?? []) count.set(f.sku.toLowerCase(), (count.get(f.sku.toLowerCase()) ?? 0) + 1)
  const popular = [...all].sort((a, b) => (count.get(b.sku.toLowerCase()) ?? 0) - (count.get(a.sku.toLowerCase()) ?? 0) || (b.ask ?? 0) - (a.ask ?? 0))
  return (
    <div className="lp">
      {net.name === 'testnet' && <p className="lp-strip">Test network. Prices come from an automated market maker. Cash and custody are simulated.</p>}
      <header className="lp-nav">
        <div className="lp-wrap wide lp-nav-in">
          <a className="lp-brand" href="#/"><IconKeystone h={24} />{brand}</a>
          <nav aria-label="Primary">
            <a href="#/markets">Markets</a>
            <a href="#/browse">Browse</a>
            <a href="#/sell">Sell</a>
            <a href="#/help">Help</a>
          </nav>
          <button className="lp-search" onClick={openPalette}><IconSearch />Search cards and sets<kbd>Ctrl K</kbd></button>
          {signedIn ? <a className="lp-signin" href="#/collection">Portfolio</a> : <a className="lp-signin" href="#/you">Sign in</a>}
          <a className="lp-btn sm" href="#/markets">Open the app</a>
        </div>
      </header>
      <Hero list={byAsk.slice(0, 6)} all={all} fills={sales.fills} />
      <Ticker fills={sales.fills} all={all} />
      <Popular list={popular.slice(0, 10)} />
      <Exchange list={popular.slice(0, 4)} />
      <Marquee />
      <Cards list={popular.slice(0, 8)} />
      <Pull list={all} />
      <Cta a={byAsk[2]} b={byAsk[0]} c={byAsk[1]} />
      <Footer />
    </div>
  )
}
