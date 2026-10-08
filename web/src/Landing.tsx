import { useEffect, useRef, useState } from 'react'
import { brand, net } from './config'
import { explorerAddress, loadSkus, type Sku } from './chain'
import { cents, usdC } from './cardParts'
import { useSales } from './desk'
import { openPalette } from './Palette'
import { IconChevron, IconSearch } from './icons'
import { Slab, cardTitle, parseName, usePoll } from './ui'

// The public front door, shown at the site root to visitors. Built to the owner's reference: a poster-style hero, a
// popular-markets carousel, a crossing marquee, a popular-cards grid, a call to action and a footer. Every name and
// price is live; nothing here is invented.

const PSA: Record<string, string> = { '10': 'Gem Mint', '9': 'Mint', '8': 'NM-MT', '7': 'Near Mint', '6': 'EX-MT', '5': 'Excellent', '4': 'VG-EX', '3': 'Very Good', '2': 'Good', '1': 'Poor' }
const gradeLabel = (s: Sku) => `${parseName(s.name).grader} ${parseName(s.name).grade} · ${PSA[parseName(s.name).grade] ?? ''}`.trim()
const price = (s: Sku) => (s.ask ? usdC(cents(s.ask)) : s.last ? usdC(cents(s.last)) : 'No ask')

function Hero({ list }: { list: Sku[] }) {
  const [i, setI] = useState(0)
  const n = list.length
  const go = (d: number) => n && setI((x) => (x + d + n) % n)
  const at = (k: number) => list[(i + k + n) % n]
  const s = at(0)
  return (
    <section className="lp-hero" aria-label="Tivan">
      <div className="lp-wrap lp-hero-in">
        <div className="lp-hero-copy">
          <h1 className="lp-poster">
            Trade graded
            <br />
            cards on a real
            <br />
            exchange<span className="lp-bang">!</span>
          </h1>
          <p className="lp-sub">Chase grails!</p>
          <p className="lp-lead">Every slab sits in a vault with its own live order book. Buy at the ask, name your price, or sell in a tap. Trades settle on {net.chain.name} in about a second.</p>
          <div className="lp-cta">
            <a className="lp-btn" href="#/markets">Browse markets</a>
            <a className="lp-btn ghost" href="#/sell">Sell a card</a>
          </div>
        </div>
        <div className="lp-hero-art" aria-live="polite">
          {s && (
            <a key={s.sku} className="lp-stack" href={`#/card/${s.sku}`} aria-label={`${cardTitle(s.name)}, ${gradeLabel(s)}, ${price(s)}`}>
              <span className="lp-back b1"><Slab name={at(1).name} size="lg" /></span>
              <span className="lp-back b2"><Slab name={at(-1).name} size="lg" /></span>
              <span className="lp-front"><Slab name={s.name} size="xl" /></span>
              <span className="lp-spark" aria-hidden>✦</span>
              <span className="lp-vert" aria-hidden>{brand}</span>
              <span className="lp-tag"><b>{price(s)}</b>{cardTitle(s.name)} · {gradeLabel(s)}</span>
            </a>
          )}
        </div>
      </div>
      {n > 1 && (
        <>
          <button className="lp-arrow prev" onClick={() => go(-1)} aria-label="Previous card"><IconChevron /></button>
          <button className="lp-arrow next" onClick={() => go(1)} aria-label="Next card"><IconChevron /></button>
          <div className="lp-dots" role="tablist" aria-label="Featured cards">
            {list.map((x, k) => <button key={x.sku} role="tab" aria-selected={k === i} aria-label={cardTitle(x.name)} onClick={() => setI(k)} />)}
          </div>
        </>
      )}
    </section>
  )
}

function Heading({ children }: { children: string }) {
  return (
    <h2 className="lp-h">
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
    <section className="lp-sec lp-light" aria-labelledby="lp-pop-h">
      <div className="lp-wrap">
        <Heading>Popular markets</Heading>
        <div className="lp-carousel">
          <button className="lp-arrow in prev" onClick={() => step(-1)} aria-label="Scroll back"><IconChevron /></button>
          <div className="lp-track" ref={track} tabIndex={0} aria-label="Popular markets">
            {list.map((s, k) => (
              <a key={s.sku} className={`lp-pop ${k === mid ? 'on' : ''}`} href={`#/card/${s.sku}`}>
                <span className="lp-pop-art"><Slab name={s.name} size="md" /></span>
                <b>{cardTitle(s.name)}</b>
                <small>{gradeLabel(s)}</small>
                <span className="lp-mini">View market</span>
              </a>
            ))}
          </div>
          <button className="lp-arrow in next" onClick={() => step(1)} aria-label="Scroll on"><IconChevron /></button>
        </div>
        <div className="lp-dots light" aria-hidden>{list.slice(0, 5).map((s, k) => <i key={s.sku} className={k === Math.min(mid, 4) ? 'on' : ''} />)}</div>
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
    <section className="lp-sec lp-light" aria-labelledby="lp-cards-h">
      <div className="lp-wrap">
        <Heading>Popular cards</Heading>
        <div className="lp-grid">
          {list.map((s) => (
            <a key={s.sku} className="lp-card" href={`#/card/${s.sku}`}>
              <span className="lp-card-art"><Slab name={s.name} size="md" /></span>
              <b>{gradeLabel(s).split(' · ')[1] || parseName(s.name).grade}</b>
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

function Cta({ a, b, c }: { a?: Sku; b?: Sku; c?: Sku }) {
  return (
    <section className="lp-cta-band" aria-label="Get started">
      <div className="lp-wrap lp-cta-in">
        <div className="lp-float" aria-hidden>
          {a && <span className="f1"><Slab name={a.name} size="lg" /></span>}
          {b && <span className="f2"><Slab name={b.name} size="lg" /></span>}
        </div>
        <div className="lp-cta-copy">
          <h2 className="lp-poster md">Ready to own your first grail?</h2>
          <a className="lp-btn" href="#/markets">Get your first card</a>
        </div>
      </div>
      {c && <span className="lp-peek" aria-hidden><Slab name={c.name} size="lg" /></span>}
    </section>
  )
}

function Footer() {
  return (
    <footer className="lp-foot">
      <div className="lp-wrap lp-foot-in">
        <div>
          <span className="lp-brand">{brand}</span>
          <p>Graded trading cards held in a vault, each with its own on-chain order book.</p>
          <a className="lp-social" href="https://github.com/bunnyyxtan/tivan" target="_blank" rel="noreferrer">GitHub</a>
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
    </footer>
  )
}

export function Landing() {
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
        <div className="lp-wrap lp-nav-in">
          <a className="lp-brand" href="#/">{brand}</a>
          <nav aria-label="Primary">
            <a href="#/markets">Markets</a>
            <a href="#/browse">Browse</a>
            <a href="#/sell">Sell</a>
            <a href="#/help">Help</a>
          </nav>
          <button className="lp-search" onClick={openPalette}><IconSearch />Search cards and sets<kbd>Ctrl K</kbd></button>
          <a className="lp-signin" href="#/you">Sign in</a>
          <a className="lp-btn sm" href="#/markets">Open the app</a>
        </div>
      </header>
      <Hero list={byAsk.slice(0, 6)} />
      <Popular list={popular.slice(0, 10)} />
      <Marquee />
      <Cards list={popular.slice(0, 8)} />
      <Cta a={byAsk[2]} b={byAsk[0]} c={byAsk[1]} />
      <Footer />
    </div>
  )
}
