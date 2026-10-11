import { net } from '../config'

// The public site map: every public page, the docs registry behind the sidebar, search and reading order, and the
// footer's groups. A link exists here only if its page exists. Nothing is listed as coming soon.

export const REPO = 'https://github.com/bunnyyxtan/tivan'
export const SITE = 'https://tivan.store'

export type DocGroup = 'start' | 'trading' | 'vault' | 'account' | 'developers'
export type DocMeta = { slug: string; title: string; group: DocGroup; summary: string; keywords: string[] }

export const DOC_GROUPS: { id: DocGroup; title: string }[] = [
  { id: 'start', title: 'Start here' },
  { id: 'trading', title: 'Trading' },
  { id: 'vault', title: 'Vault and cards' },
  { id: 'account', title: 'Your account' },
  { id: 'developers', title: 'Developers' },
]

export const DOCS: DocMeta[] = [
  { slug: 'how-it-works', title: 'How Tivan works', group: 'start', summary: 'The whole system in one page, with a paragraph per part and a link to the page that owns the detail.', keywords: ['overview', 'architecture', 'map', 'sku', 'token'] },
  { slug: 'getting-started', title: 'Getting started', group: 'start', summary: 'Create a passkey account, add test dollars, and get gas for your first transaction.', keywords: ['sign up', 'passkey', 'faucet', 'gas', 'mon', 'cash'] },
  { slug: 'first-trade', title: 'Your first trade', group: 'start', summary: 'Buy a card at the ask, read the receipt, and find the transaction on the Monad explorer.', keywords: ['buy', 'receipt', 'explorer', 'settle'] },
  { slug: 'glossary', title: 'Glossary', group: 'start', summary: 'One definition for every term Tivan uses. If a page says otherwise, this page wins.', keywords: ['definitions', 'terms', 'meaning'] },
  { slug: 'order-books', title: 'Order books and prices', group: 'trading', summary: 'One Kuru order book per card and grade, prices in whole cents, sizes in whole cards, and how fees are read.', keywords: ['kuru', 'clob', 'ask', 'bid', 'spread', 'tick', 'fee'] },
  { slug: 'selling', title: 'Offers and selling', group: 'trading', summary: 'Rest an offer below the ask, sell now into the best offer, list at your own price, and cancel.', keywords: ['offer', 'bid', 'list', 'cancel', 'sell now', 'post only'] },
  { slug: 'vaulting', title: 'Vaulting a card', group: 'vault', summary: 'From a grading cert to a tradable token, what is checked at each step, and when the first copy of a card lists its market.', keywords: ['cert', 'attest', 'custody', 'mint', 'deposit'] },
  { slug: 'verification', title: 'Grade verification', group: 'vault', summary: 'How a grade is taken from the grader registry and never from the depositor, and the Chainlink CRE workflow that does it.', keywords: ['chainlink', 'cre', 'oracle', 'psa', 'registry', 'gradeoracle'] },
  { slug: 'redemption', title: 'Redeeming a card', group: 'vault', summary: 'Burn one token for the oldest vaulted copy of that card and grade, with only a hash of the shipping details on chain.', keywords: ['redeem', 'fifo', 'ship', 'burn', 'withdraw card'] },
  { slug: 'passkeys', title: 'Passkey accounts', group: 'account', summary: 'How a passkey becomes a Monad account, how sessions are kept, and how to back up your key.', keywords: ['mera', 'webauthn', 'prf', 'session', 'export', 'backup'] },
  { slug: 'private-vault', title: 'The private vault', group: 'account', summary: 'A sealed note store that only your passkey can open, stored on chain as ciphertext.', keywords: ['sealedbox', 'encryption', 'notes', 'aes', 'hkdf'] },
  { slug: 'agent-plugin', title: 'Agent Wallet plugin', group: 'developers', summary: 'Read every book and rest bids from the MetaMask Agent Wallet with mm tivan.', keywords: ['metamask', 'agent', 'cli', 'mm', 'plugin', 'ai'] },
  { slug: 'data', title: 'Indexer and data', group: 'developers', summary: 'The Envio GraphQL endpoint behind price history, trades and open orders, with example queries.', keywords: ['envio', 'graphql', 'hyperindex', 'api', 'query'] },
]

export const docHref = (slug: string) => (slug ? `/docs/${slug}` : '/docs')
export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug)
const ORDER = DOC_GROUPS.flatMap((g) => DOCS.filter((d) => d.group === g.id))
export function docNeighbours(slug: string) {
  const i = ORDER.findIndex((d) => d.slug === slug)
  return { prev: i > 0 ? ORDER[i - 1] : undefined, next: i >= 0 ? ORDER[i + 1] : ORDER[0] }
}

export type LegalMeta = { slug: string; title: string; summary: string; updated: string }
export const LEGAL: LegalMeta[] = [
  { slug: 'terms', title: 'Terms of use', summary: 'The rules for using Tivan, what is and is not promised, and who is responsible for what.', updated: '2026-10-11' },
  { slug: 'privacy', title: 'Privacy policy', summary: 'What stays on your device, what is public on the chain, and which services see your requests.', updated: '2026-10-11' },
  { slug: 'risk', title: 'Risk disclosure', summary: 'The ways using Tivan can go wrong, stated plainly, from contract risk to custody and liquidity.', updated: '2026-10-11' },
  ...(net.name === 'testnet' ? [{ slug: 'testnet', title: 'Testnet disclosure', summary: 'What is simulated on the test network and what is real, so nothing here is mistaken for money.', updated: '2026-10-11' }] : []),
  { slug: 'cookies', title: 'Cookies and storage', summary: 'Every key the app keeps in your browser and why. No cookies, no tracking, no banner.', updated: '2026-10-11' },
  { slug: 'acceptable-use', title: 'Acceptable use', summary: 'What you may not do with the website and its relay services, and the hourly caps.', updated: '2026-10-11' },
  { slug: 'market-data', title: 'Market data', summary: 'Where every price comes from, and why none of them is a valuation.', updated: '2026-10-11' },
  { slug: 'ai', title: 'AI disclosure', summary: 'There is no model inside the product. How AI agents can trade, and how AI tools helped build it.', updated: '2026-10-11' },
  { slug: 'credits', title: 'Image credits and licences', summary: 'Where every card picture comes from, its licence, and the open-source software Tivan is built on.', updated: '2026-10-11' },
]
export const legalHref = (slug: string) => (slug ? `/legal/${slug}` : '/legal')
export const legalBySlug = (slug: string) => LEGAL.find((l) => l.slug === slug)

export type SiteLink = [label: string, href: string]
export const FOOTER_GROUPS: { title: string; links: SiteLink[] }[] = [
  { title: 'Product', links: [['Markets', '/markets'], ['Browse', '/browse'], ['Sell a card', '/sell'], ['Vault a card', '/vault'], ['Portfolio', '/collection'], ['League', '/league']] },
  { title: 'Protocol', links: [['Documentation', '/docs'], ['Whitepaper', '/whitepaper'], ['How Tivan earns', '/economics'], ['How it works', '/docs/how-it-works'], ['Order books', '/docs/order-books'], ['Grade verification', '/docs/verification'], ['Glossary', '/docs/glossary']] },
  { title: 'Trust', links: [['Contracts', '/contracts'], ['Security', '/security'], ['Status', '/status'], ['Source code', REPO], ['Agent plugin', '/docs/agent-plugin'], ['Help center', '/help']] },
  { title: 'Legal', links: [['Legal hub', '/legal'], ...(['terms', 'privacy', 'cookies', 'risk', 'testnet', 'ai'] as const).flatMap((s) => LEGAL.filter((l) => l.slug === s).map((l) => [l.title, legalHref(l.slug)] as SiteLink))] },
]
export const FOOTER_RAIL: SiteLink[] = [['Terms', '/legal/terms'], ['Privacy', '/legal/privacy'], ['Cookies', '/legal/cookies'], ['Acceptable use', '/legal/acceptable-use'], ['Risk', '/legal/risk'], ['Contracts', '/contracts'], ['Status', '/status'], ['GitHub', REPO]]
export const isExternal = (href: string) => /^https?:/.test(href)

/** Search across docs, legal and the trust pages: titles, summaries and keywords, not body text. */
export type SearchHit = { section: string; title: string; summary: string; href: string }
const INDEX: (SearchHit & { words: string })[] = [
  ...DOCS.map((d) => ({ section: 'Docs', title: d.title, summary: d.summary, href: docHref(d.slug), words: d.keywords.join(' ') })),
  ...LEGAL.map((l) => ({ section: 'Legal', title: l.title, summary: l.summary, href: legalHref(l.slug), words: '' })),
  { section: 'Protocol', title: 'Whitepaper', summary: 'The design document: the vault, one book per card, verification, custody and the trust model.', href: '/whitepaper', words: 'design paper' },
  { section: 'Protocol', title: 'How Tivan earns', summary: 'The four revenue lines, the rates intended for each, and the order they switch on.', href: '/economics', words: 'business model fees revenue custody lending economics pricing' },
  { section: 'Trust', title: 'Contracts', summary: 'Every deployed address with a link to the explorer.', href: '/contracts', words: 'address vault token oracle' },
  { section: 'Trust', title: 'Security', summary: 'How keys, sessions, the relay and the website are protected, and how to report a problem.', href: '/security', words: 'csp headers audit report bug' },
  { section: 'Trust', title: 'Status', summary: 'Live checks of the chain, the indexer and the attestor.', href: '/status', words: 'uptime health live' },
]
export function searchSite(q: string): SearchHit[] {
  const t = q.trim().toLowerCase()
  if (t.length < 2) return []
  return INDEX.filter((e) => `${e.title} ${e.summary} ${e.words}`.toLowerCase().includes(t)).slice(0, 8)
}

/** Every public route this file knows, for the router and the sitemap. */
export const PUBLIC_ROUTES = ['docs', 'whitepaper', 'legal', 'contracts', 'security', 'status'] as const
