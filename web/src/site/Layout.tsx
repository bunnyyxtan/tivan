import { useEffect, useRef, useState, type ReactNode } from 'react'
import { brand, net } from '../config'
import { explorerAddress } from '../chain'
import { IconChevron, IconKeystone, IconSearch } from '../icons'
import { navigate } from '../route'
import { DOC_GROUPS, DOCS, FOOTER_GROUPS, FOOTER_RAIL, docHref, docNeighbours, isExternal, searchSite, type SearchHit } from './siteMap'

// The public site's frame: the top bar, the document and docs layouts, the contents rail, the small building blocks
// every page is written in, and the one footer used on every public page, the landing page and inside the app.

const ext = (href: string) => (isExternal(href) ? { target: '_blank', rel: 'noreferrer' } : {})

export function PublicNav() {
  const links: [string, string][] = [['Markets', '/markets'], ['Docs', '/docs'], ['Whitepaper', '/whitepaper'], ['Security', '/security'], ['Legal', '/legal']]
  const here = location.pathname
  return (
    <header className="pub-nav">
      <div className="pub-wrap pub-nav-in">
        <a className="pub-brand" href="/" aria-label={`${brand} home`}>
          <span className="brand-mark" aria-hidden><IconKeystone /></span>
          <span>{brand}</span>
        </a>
        <nav aria-label="Site">
          {links.map(([l, h]) => (
            <a key={h} href={h} aria-current={here === h || (h !== '/markets' && here.startsWith(h + '/')) ? 'page' : undefined}>{l}</a>
          ))}
        </nav>
        <a className="btn md pub-cta" href="/markets">Open the app</a>
      </div>
    </header>
  )
}

/** A public page: top bar, content and the footer. */
export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="pub">
      <PublicNav />
      <main className="pub-wrap pub-main">{children}</main>
      <SiteFooter />
    </div>
  )
}

export type Crumb = [label: string, href?: string]
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav className="pub-crumbs" aria-label="Breadcrumb">
      {trail.map(([l, h], i) => (
        <span key={l}>
          {i > 0 && <IconChevron />}
          {h ? <a href={h}>{l}</a> : <span aria-current="page">{l}</span>}
        </span>
      ))}
    </nav>
  )
}

export function DocHeader({ eyebrow, title, standfirst, meta, crumbs, actions }: { eyebrow: string; title: string; standfirst?: ReactNode; meta?: [string, ReactNode][]; crumbs: Crumb[]; actions?: ReactNode }) {
  return (
    <header className="pub-head">
      <Breadcrumbs trail={crumbs} />
      <span className="pub-eyebrow accent">{eyebrow}</span>
      <h1>{title}</h1>
      {standfirst && <p className="pub-standfirst">{standfirst}</p>}
      {(meta?.length || actions) && (
        <div className="pub-head-row">
          {meta && (
            <dl className="pub-head-meta">
              {meta.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {actions}
        </div>
      )}
    </header>
  )
}

export const PrintButton = () => (
  <button className="ghost line md pub-print" onClick={() => print()}>
    Print or save as PDF
  </button>
)

/** A standalone document (whitepaper, legal, trust pages) with a contents rail on wide screens. */
export function DocumentLayout(p: { eyebrow: string; title: string; standfirst?: ReactNode; meta?: [string, ReactNode][]; crumbs: Crumb[]; actions?: ReactNode; after?: ReactNode; children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null)
  return (
    <PublicPage>
      <div className="pub-doc-grid">
        <article className="pub-article">
          <DocHeader {...p} />
          <div ref={body} className="pub-body">
            {p.children}
          </div>
        </article>
        <aside className="pub-rail">
          <Contents body={body} />
        </aside>
      </div>
      {p.after && <div className="pub-after">{p.after}</div>}
    </PublicPage>
  )
}

/** Documentation: a sidebar with search, the page, a contents rail and the reading order. */
export function DocsLayout({ slug, title, standfirst, children }: { slug: string; title: string; standfirst?: ReactNode; children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null)
  const { prev, next } = docNeighbours(slug)
  return (
    <PublicPage>
      <div className="pub-docs-grid">
        <DocsSidebar active={slug} />
        <article className="pub-article">
          <DocHeader eyebrow="Documentation" title={title} standfirst={standfirst} crumbs={slug ? [[brand, '/'], ['Docs', '/docs'], [title]] : [[brand, '/'], ['Docs']]} />
          <div ref={body} className="pub-body">
            {children}
          </div>
          <nav className="pub-prevnext" aria-label="Reading order">
            {prev ? (
              <a href={docHref(prev.slug)}>
                <span>Previous</span>
                {prev.title}
              </a>
            ) : <span />}
            {next && (
              <a href={docHref(next.slug)} className="next">
                <span>Next</span>
                {next.title}
              </a>
            )}
          </nav>
        </article>
        <aside className="pub-rail">
          <Contents body={body} />
        </aside>
      </div>
    </PublicPage>
  )
}

function DocsSidebar({ active }: { active: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="pub-side">
      <button className="pub-side-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="pub-eyebrow">Documentation</span>
        <IconChevron />
      </button>
      <div className={`pub-side-body ${open ? 'open' : ''}`}>
        <DocsSearch />
        <nav aria-label="Documentation">
          <a href="/docs" aria-current={active === '' ? 'page' : undefined}>Overview</a>
          {DOC_GROUPS.map((g) => (
            <div key={g.id} className="pub-side-group">
              <span className="pub-eyebrow">{g.title}</span>
              {DOCS.filter((d) => d.group === g.id).map((d) => (
                <a key={d.slug} href={docHref(d.slug)} aria-current={d.slug === active ? 'page' : undefined}>{d.title}</a>
              ))}
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}

function DocsSearch() {
  const [q, setQ] = useState('')
  const hits: SearchHit[] = searchSite(q)
  return (
    <div className="pub-search">
      <label className="pub-search-field">
        <IconSearch />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the docs" aria-label="Search the docs" onKeyDown={(e) => {
          if (e.key === 'Escape') setQ('')
          if (e.key === 'Enter' && hits[0]) (navigate(hits[0].href), setQ(''))
        }} />
      </label>
      {q.trim().length >= 2 && (
        <div className="pub-search-hits" role="listbox">
          {hits.length ? hits.map((h) => (
            <a key={h.href} href={h.href} onClick={() => setQ('')}>
              <span className="pub-eyebrow">{h.section}</span>
              <b>{h.title}</b>
              <small>{h.summary}</small>
            </a>
          )) : <p>Nothing matches. Search covers titles, summaries and keywords.</p>}
        </div>
      )}
    </div>
  )
}

/** The contents rail, read from the page's own sections, with the one in view marked. */
function Contents({ body }: { body: React.RefObject<HTMLDivElement | null> }) {
  const [items, setItems] = useState<[string, string][]>([])
  const [at, setAt] = useState('')
  useEffect(() => {
    const secs = [...(body.current?.querySelectorAll<HTMLElement>('section[id]') ?? [])]
    setItems(secs.map((s) => [s.id, s.querySelector('h2')?.textContent ?? s.id]))
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setAt(e.target.id)), { rootMargin: '-15% 0px -70% 0px' })
    secs.forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [body])
  if (items.length < 2) return null
  return (
    <nav className="pub-toc" aria-label="On this page">
      <span className="pub-eyebrow">On this page</span>
      {items.map(([id, t]) => (
        <a key={id} href={`#${id}`} aria-current={at === id ? 'true' : undefined}>{t}</a>
      ))}
    </nav>
  )
}

// ---- building blocks
export function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="pub-sec">
      <h2>
        <a href={`#${id}`} className="pub-anchor" aria-hidden tabIndex={-1}>#</a>
        {title}
      </h2>
      {children}
    </section>
  )
}
export const Prose = ({ children }: { children: ReactNode }) => <div className="pub-prose">{children}</div>
export function Callout({ tone = 'note', title, children }: { tone?: 'note' | 'caution'; title: string; children: ReactNode }) {
  return (
    <aside className={`pub-callout ${tone}`}>
      <span className="pub-eyebrow">{title}</span>
      <div className="pub-prose">{children}</div>
    </aside>
  )
}
export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="pub-kv">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}
export function Address({ value, href = explorerAddress(value) }: { value: string; href?: string }) {
  const [done, setDone] = useState(false)
  return (
    <span className="pub-addr">
      <a href={href} target="_blank" rel="noreferrer" className="mono">{value}</a>
      <button onClick={() => navigator.clipboard?.writeText(value).then(() => (setDone(true), setTimeout(() => setDone(false), 1400)))} aria-label={`Copy ${value}`}>
        {done ? 'Copied' : 'Copy'}
      </button>
    </span>
  )
}
export const Code = ({ children, label }: { children: string; label?: string }) => (
  <figure className="pub-code">
    {label && <figcaption className="pub-eyebrow">{label}</figcaption>}
    <pre><code>{children}</code></pre>
  </figure>
)
export const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a className="u" href={href} {...ext(href)}>{children}</a>
)
export function Related({ title = 'Read next', links }: { title?: string; links: [label: string, href: string, summary: string][] }) {
  return (
    <section className="pub-related" aria-label={title}>
      <span className="pub-eyebrow">{title}</span>
      <div>
        {links.map(([l, h, s]) => (
          <a key={h} href={h} {...ext(h)}>
            <b>{l}</b>
            <small>{s}</small>
          </a>
        ))}
      </div>
    </section>
  )
}

// ---- footer
/** A banknote guilloche drawn once: two rosettes and a band of interlaced waves, the security printing on a grading cert. */
const PLATE = (() => {
  const W = 1440
  const H = 420
  const f = (n: number) => n.toFixed(1)
  const waves: string[] = []
  for (let k = 0; k < 26; k++) {
    let d = ''
    for (let x = 0; x <= W; x += 12) {
      const y = 250 + Math.sin(x / 70 + k * 0.42) * 46 + Math.sin(x / 190 - k * 0.2) * 34 + (k - 13) * 4.2
      d += `${x ? 'L' : 'M'}${f(x)} ${f(y)}`
    }
    waves.push(d)
  }
  // Each rosette is a hypotrochoid whose radii divide evenly, so it closes in one turn; nested copies give the engraved depth.
  const rosette = (cx: number, cy: number, R: number, r: number, dd: number) => {
    let d = ''
    for (let i = 0; i <= 360; i += 1) {
      const t = (i * Math.PI) / 180
      const x = cx + (R - r) * Math.cos(t) + dd * Math.cos(((R - r) / r) * t)
      const y = cy + (R - r) * Math.sin(t) - dd * Math.sin(((R - r) / r) * t)
      d += `${i ? 'L' : 'M'}${f(x)} ${f(y)}`
    }
    return d + 'Z'
  }
  const set = (cx: number, cy: number, R: number) => [30, 44, 58, 72].map((dd) => rosette(cx, cy, R, R / 18, dd))
  return { W, H, waves, rosettes: [...set(250, 230, 108), ...set(1190, 210, 126)] }
})()

function Plate() {
  return (
    <svg className="site-plate" viewBox={`0 0 ${PLATE.W} ${PLATE.H}`} preserveAspectRatio="xMidYMax slice" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="0.8">
        {PLATE.waves.map((d, i) => <path key={i} d={d} />)}
        {PLATE.rosettes.map((d, i) => <path key={i} d={d} strokeWidth="0.6" />)}
      </g>
    </svg>
  )
}

/** The one footer: identity, four link groups, a small-print rail and the network line. */
export function SiteFooter() {
  return (
    <footer className="site-foot">
      <Plate />
      <div className="pub-wrap site-foot-in">
        <div className="site-foot-top">
          <div className="site-foot-id">
            <a href="/" className="site-foot-word" aria-label={`${brand} home`}>
              <span className="brand-mark" aria-hidden><IconKeystone h={34} /></span>
              <span>{brand}</span>
            </a>
            <p>The graded card exchange where every card and grade has its own order book.</p>
          </div>
          <div className="site-foot-cols">
            {FOOTER_GROUPS.map((g) => (
              <nav key={g.title} aria-label={g.title}>
                <span className="pub-eyebrow">{g.title}</span>
                {g.links.map(([l, h]) => (
                  <a key={l} href={h} {...ext(h)}>{l}</a>
                ))}
              </nav>
            ))}
          </div>
        </div>
        <div className="site-foot-rail">
          {FOOTER_RAIL.map(([l, h]) => (
            <a key={l} href={h} {...ext(h)}>{l}</a>
          ))}
        </div>
        <div className="site-foot-bottom">
          <span><IconKeystone h={14} /> 2026 {brand}</span>
          {net.vault && <a href={explorerAddress(net.vault)} target="_blank" rel="noreferrer">Built on Monad</a>}
        </div>
      </div>
    </footer>
  )
}
