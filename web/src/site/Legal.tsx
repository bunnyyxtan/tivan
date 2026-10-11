import type { ReactNode } from 'react'
import { brand, net } from '../config'
import { A, Callout, DocumentLayout, KeyValue, PrintButton, Prose, PublicPage, Related, Section } from './Layout'
import { LEGAL, REPO, legalBySlug, legalHref } from './siteMap'

// The legal documents. Each is written for this product, short because the honest version of each is short, and dated
// in siteMap.LEGAL so the date moves whenever the document does.
const test = net.name === 'testnet'
const date = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

export function LegalHub() {
  return (
    <DocumentLayout
      eyebrow="Legal"
      title="Legal documents"
      standfirst={`${LEGAL.length} documents, each written for ${brand} rather than adapted from a template.`}
      crumbs={[[brand, '/'], ['Legal']]}
      after={<Related title="Related" links={[['Security', '/security', 'How keys, sessions and the relay are protected.'], ['Contracts', '/contracts', 'Every deployed address, linked to the explorer.']]} />}
    >
      <Section id="documents" title="The documents">
        <ul className="pub-doclist">
          {LEGAL.map((l) => (
            <li key={l.slug}>
              <a href={legalHref(l.slug)}>
                <span>
                  <b>{l.title}</b>
                  <time>Updated {date(l.updated)}</time>
                </span>
                <small>{l.summary}</small>
              </a>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="operator" title="Who operates Tivan">
        <Prose>
          <p>{brand} is built and operated by one independent developer. No company is incorporated yet, so there is no registered office. The contact channel is the issue tracker on <A href={`${REPO}/issues`}>GitHub</A>. It is a public channel, not a legal address.</p>
        </Prose>
      </Section>
      <Section id="reading" title="How to read them">
        <Prose>
          <p>Where a document states a technical fact, it is taken from the contracts or the code, not from marketing copy. Where it states a limit, a contract enforces it or it is not claimed.{test ? ` Every document describes a test network deployment where nothing has money value.` : ''}</p>
        </Prose>
      </Section>
    </DocumentLayout>
  )
}

// Every browser storage key the app uses, for the cookies page. Keep in step with the code when a key is added.
const STORAGE: [key: string, kind: string, purpose: string][] = [
  ['tivan IndexedDB, session', 'IndexedDB', 'Your signing key for up to seven days, encrypted with a browser key that cannot be exported.'],
  ['slab.passkey', 'Local', 'Which passkey to ask for at sign-in. Public metadata only, never a key.'],
  ['slab.deviceKey', 'Local', 'The test account kept on this device when you continue without a passkey. Test network only.'],
  ['tivan.prefs', 'Local', 'Theme, motion and haptics settings.'],
  ['slab.watch', 'Local', 'Your watchlist.'],
  ['tivan.alerts', 'Local', 'Your price alerts.'],
  ['tivan.notes', 'Local', 'Your private notes on cards.'],
  ['tivan.recent', 'Local', 'Your last five searches.'],
  ['tivan.viewed', 'Local', 'Cards you viewed recently.'],
  ['tivan.badges', 'Local', 'Badges you earned.'],
  ['tivan.txlog.v1 and tivan.txpending.v1', 'Local', 'Your activity log and any transaction still confirming.'],
  ['tivan.withdrawTo', 'Local', 'Addresses you withdrew to before.'],
  ['tivan.welcomed and tivan.checklist.off', 'Local', 'Whether you have seen the welcome and dismissed the checklist.'],
  ['tivan.rail', 'Local', 'Whether the sidebar is collapsed.'],
  ['tivan.skus and slab.skus', 'Local', 'The last market list, so pages draw at once.'],
  ['tivan.returnTo and tivan.order', 'Session', 'Where to return after signing in, and the order you were typing.'],
  ['tivan.scroll and tivan.compare', 'Session', 'Your scroll position in a list and the cards you are comparing.'],
]

const DOCS: Record<string, { standfirst: string; body: () => ReactNode }> = {
  terms: {
    standfirst: `The terms for using ${brand}. The website is one way to reach public contracts. It is not the contracts, and it holds nothing of yours.`,
    body: () => (
      <>
        {test && <Callout tone="caution" title="The short version"><p>Everything here runs on {net.chain.name} and has no money value. Nothing here is advice or an offer to sell.</p></Callout>}
        <Section id="what" title="What this is">
          <Prose>
            <p>{brand} is a website that reads and writes public smart contracts on {net.chain.name}, chain {net.chain.id}. It shows market data, builds transactions and shows you what a contract returned. The contracts are permissionless, so anyone can call them with their own tools. Their addresses are on the <A href="/contracts">contracts page</A>.</p>
          </Prose>
        </Section>
        <Section id="agreement" title="Agreement">
          <Prose>
            <p>By using {brand} you agree to these terms. If you do not agree, do not use the service.</p>
          </Prose>
        </Section>
        <Section id="eligibility" title="Who can use it">
          <Prose>
            <p>You must be 18 or older and allowed to use a service like this where you live. You are responsible for any legal, tax or regulatory duty that applies to you.</p>
          </Prose>
        </Section>
        <Section id="custody" title="No custody of your keys">
          <Prose>
            <p>Your account is your passkey. {brand} never holds it and cannot sign for you, reset it or recover it. Every transaction that moves value is signed on your device. A transaction sent to a public chain cannot be recalled, and nobody can reverse one you signed by mistake.</p>
          </Prose>
        </Section>
        <Section id="trading" title="Trading">
          <Prose>
            <p>Prices come from orders on public on-chain order books{test ? `, and on the test network from an automated market maker that ${brand} runs` : ''}. A trade that settles on the chain is final. Nothing on this site is investment, legal or tax advice, or an offer to buy or sell anything.</p>
          </Prose>
        </Section>
        <Section id="fair-use" title="Fair use">
          <Prose>
            <p>The test gas faucet and vault check-in are free and capped per hour and per visitor so everyone gets a turn. Do not script around the caps, attack the service, scrape it in a way that degrades it, or use it to harm anyone.</p>
          </Prose>
        </Section>
        <Section id="ip" title="Names and pictures">
          <Prose>
            <p>Card names, artwork and grading marks belong to their owners. {brand} is not affiliated with or endorsed by PSA, The Pokémon Company, Wizards of the Coast, Konami, Topps or any player or league. Sources are on the <A href="/legal/credits">credits page</A>.</p>
          </Prose>
        </Section>
        <Section id="warranty" title="No warranty">
          <Prose>
            <p>{brand} is open source under the MIT licence and provided as it is, with no warranty that it is available, correct or fit for any purpose. The contracts have not been audited.</p>
          </Prose>
        </Section>
        <Section id="liability" title="Limitation of liability">
          <Prose>
            <p>To the extent the law allows, {brand} and its contributors are not liable for any loss that comes from using the website or the contracts, including lost funds, failed transactions or wrong data.</p>
          </Prose>
        </Section>
        <Section id="changes" title="Changes">
          <Prose>
            <p>These terms may change and the date at the top moves when they do. {test ? 'The test deployment may be changed, paused or reset at any time.' : 'The service may be changed or paused at any time.'}</p>
          </Prose>
        </Section>
      </>
    ),
  },
  privacy: {
    standfirst: `How ${brand} handles information. There is no account database, no email address and no password.`,
    body: () => (
      <>
        <Callout title="The short version"><p>Your passkey and settings stay on your device. Your trades are public transactions, as on any public chain. There are no cookies, analytics, ads or tracking scripts.</p></Callout>
        <Section id="not-collected" title="What is not collected">
          <Prose>
            <p>{brand} has no sign-up form and no server-side user database. It never asks for your name, email address, phone number or a password, and it builds no profile of you.</p>
          </Prose>
        </Section>
        <Section id="device" title="What stays on your device">
          <Prose>
            <p>Your passkey is created and kept by your device's passkey manager and never leaves it. The key that signs your trades is derived from it when you sign in and is kept in this browser for up to seven days, encrypted with a browser key that cannot be exported.</p>
            <p>Your settings, watchlist, recent searches, price alerts, badges and activity log are saved in this browser's storage and are not sent anywhere.</p>
          </Prose>
        </Section>
        <Section id="chain" title="What is public on the chain">
          <Prose>
            <p>Your wallet address and every order, trade, deposit, transfer and redemption are transactions on {net.chain.name}. Anyone can read them, and nobody can change or delete them, including {brand}.</p>
            <p>The private vault is the exception. It is encrypted in your browser before it is stored, so the chain holds only ciphertext nobody can read without your passkey.</p>
          </Prose>
        </Section>
        <Section id="services" title="Services that handle your requests">
          <Prose>
            <p>The services the website connects to see your IP address and the request itself.</p>
            <ul>
              <li>Vercel hosts the website.</li>
              <li>Alchemy, Quicknode and Monad's public endpoint read the chain and send transactions.</li>
              <li>Envio serves market and trade history.</li>
              <li>Google Fonts serves the typefaces.</li>
              <li>{brand}'s attestor on Render receives your wallet address when you ask for test gas and the cert number when you vault a card.</li>
            </ul>
            <p>The attestor's own code logs errors only. Vercel and Render keep standard access logs under their own policies.</p>
          </Prose>
        </Section>
        <Section id="cookies" title="Cookies and analytics">
          <Prose>
            <p>{brand} sets no cookies and runs no analytics, advertising or tracking scripts, which is why there is no cookie banner. Browser storage is used only for the features above, and every key is listed on the <A href="/legal/cookies">cookies and storage page</A>.</p>
          </Prose>
        </Section>
        <Section id="control" title="Your control">
          <Prose>
            <p>Signing out ends the session on this device. Clearing this site's data in your browser removes everything stored on the device. Records on the chain stay, because no one can remove them.</p>
          </Prose>
        </Section>
      </>
    ),
  },
  risk: {
    standfirst: 'The ways using Tivan can go wrong. Read this before you trade, and again before real money is ever involved.',
    body: () => (
      <>
        <Section id="contracts" title="Contract risk">
          <Prose>
            <p>The vault, the card tokens and the order books are smart contracts. They have not been audited. A bug could lock or lose funds or cards, and a transaction that settles cannot be undone.</p>
          </Prose>
        </Section>
        <Section id="custody" title="Custody risk">
          <Prose>
            <p>A card token is only worth the slab behind it. You rely on the custodian to hold the slab, insure it and ship it when you redeem. {test ? 'On the test network custody is simulated and no slab is held.' : ''}</p>
          </Prose>
        </Section>
        <Section id="verification" title="Verification risk">
          <Prose>
            <p>A token's grade comes from the grader's registry. A registry error, a forged slab that passes the registry, or a fault in the relay or oracle could put a card behind a token that does not match it.</p>
          </Prose>
        </Section>
        <Section id="sameness" title="Copies are not identical">
          <Prose>
            <p>All copies of one card and grade share one token, yet copies differ in centring and eye appeal. Redemption releases the oldest copy first, so you cannot choose which one you receive.</p>
          </Prose>
        </Section>
        <Section id="liquidity" title="Liquidity and price risk">
          <Prose>
            <p>A book can be thin or empty, and prices can move sharply. You may not be able to sell at the price you want or at all.{test ? ' Test prices come from an automated market maker and are not a market valuation.' : ''}</p>
          </Prose>
        </Section>
        <Section id="keys" title="Key risk">
          <Prose>
            <p>Losing every copy of your passkey without an exported key loses the account. Anyone who obtains your exported key controls it.</p>
          </Prose>
        </Section>
        <Section id="infrastructure" title="Infrastructure risk">
          <Prose>
            <p>The website, RPC providers, indexer and attestor can be slow or unavailable. The chain itself can halt or reorganise. Data shown in the app can lag the chain.</p>
          </Prose>
        </Section>
        <Section id="regulatory" title="Regulatory risk">
          <Prose>
            <p>Rules for tokenised collectibles differ by country and are changing. A change could limit or end the service where you live.</p>
          </Prose>
        </Section>
      </>
    ),
  },
  testnet: {
    standfirst: 'What is simulated on the test network and what is real, so nothing here is mistaken for money.',
    body: () => (
      <>
        <Section id="simulated" title="Simulated">
          <Prose>
            <ul>
              <li>Dollars are TestUSD, an open test token anyone can mint. They have no value.</li>
              <li>MON on the test network is test gas with no value.</li>
              <li>Custody is simulated. No physical slab sits behind any token, and redeeming ships nothing.</li>
              <li>Certs come from a demo registry shaped like PSA's responses, not from PSA.</li>
              <li>Prices come from an automated market maker run by {brand}, which also vaults fresh copies with synthetic test certs when a card sells out. Its trades are not user activity.</li>
            </ul>
          </Prose>
        </Section>
        <Section id="real" title="Real">
          <Prose>
            <ul>
              <li>Every order, trade, offer, cancel, transfer and redemption is a real transaction on Monad testnet that you can look up.</li>
              <li>The vault, tokens and books are the real contracts, and the rules they enforce are the real rules.</li>
              <li>Your passkey account is a real account, and its key works on any compatible wallet.</li>
            </ul>
          </Prose>
        </Section>
      </>
    ),
  },
  credits: {
    standfirst: 'Where every card picture comes from, its licence, and the open-source software Tivan is built on.',
    body: () => (
      <>
        <Section id="images" title="Card images">
          <Prose>
            <p>Card pictures are reference images of each card, not photographs of the slab in the vault. The cards and artwork belong to their owners and are shown for demonstration only.</p>
            <ul>
              <li>Sports cards are public-domain vintage scans from <A href="https://commons.wikimedia.org">Wikimedia Commons</A>.</li>
              <li>Pokémon cards come from the <A href="https://pokemontcg.io">Pokémon TCG API</A> image server.</li>
              <li>Magic cards come from <A href="https://scryfall.com">Scryfall</A>.</li>
              <li>Yu-Gi-Oh! cards come from the <A href="https://ygoprodeck.com">YGOPRODeck</A> card database.</li>
            </ul>
            <p>Per-file sources and licences are in <A href={`${REPO}/blob/main/web/public/cards/CREDITS.md`}>CREDITS.md</A>.</p>
          </Prose>
        </Section>
        <Section id="software" title="Open-source software">
          <Prose>
            <p>{brand} is built on <A href="https://kuru.io">Kuru</A> order books, <A href="https://github.com/OpenZeppelin/openzeppelin-contracts">OpenZeppelin Contracts</A>, forge-std, <A href="https://viem.sh">viem</A>, React, Vite, three.js, <A href="https://docs.monad.xyz/guides/mera">Mera</A> passkeys, <A href="https://envio.dev">Envio HyperIndex</A> and the Chainlink CRE SDK.</p>
          </Prose>
        </Section>
        <Section id="licence" title="Tivan's licence">
          <Prose>
            <p>{brand}'s own code is released under the <A href={`${REPO}/blob/main/LICENSE`}>MIT licence</A>.</p>
          </Prose>
        </Section>
      </>
    ),
  },
  cookies: {
    standfirst: `Every key ${brand} keeps in your browser, why it exists and how long it lasts. There is no tracking, so there is no consent banner.`,
    body: () => (
      <>
        <Callout title="The short version"><p>{brand} sets no cookies. It keeps a small number of entries in your browser's own storage so the app works, and none of them is sent to {brand} or used to follow you.</p></Callout>
        <Section id="cookies" title="Cookies">
          <Prose>
            <p>The website sets no cookies, first party or third party. Vercel, which hosts it, sets none for a static site like this one, and Google Fonts serves typefaces without cookies.</p>
          </Prose>
        </Section>
        <Section id="keys" title="Every key the app stores">
          <Prose>
            <p>Local storage lasts until you clear it. Session storage ends when you close the tab. Nothing below leaves your device.</p>
          </Prose>
          <div className="pub-table-wrap">
            <table className="pub-table">
              <thead>
                <tr><th>Key</th><th>Kind</th><th>Purpose</th></tr>
              </thead>
              <tbody>
                {STORAGE.map(([k, kind, why]) => (
                  <tr key={k}><td className="mono">{k}</td><td>{kind}</td><td>{why}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
        <Section id="essential" title="Essential and optional">
          <Prose>
            <p>The session, passkey reference and transaction log keep the app working. Everything else remembers a choice you made, such as your theme or watchlist. None of it is advertising or analytics, and each entry exists only because of something you did in the app.</p>
          </Prose>
        </Section>
        <Section id="clear" title="Clearing it">
          <Prose>
            <p>Clear this site's data in your browser settings to remove every key above. You will be signed out and your settings reset. Your account is unaffected, because your passkey rebuilds it.</p>
          </Prose>
        </Section>
      </>
    ),
  },
  'acceptable-use': {
    standfirst: `What you may not do with ${brand}'s website and its services, and what this document cannot reach.`,
    body: () => (
      <>
        <Section id="scope" title="What this covers">
          <Prose>
            <p>This policy covers the website at tivan.store and the services it runs, the attestor relay, the test gas faucet and the private-vault relay. It does not cover the contracts, which are public and permissionless.</p>
          </Prose>
        </Section>
        <Section id="not-allowed" title="What you may not do">
          <Prose>
            <ul>
              <li>Attack, overload or probe the website or the relay for weaknesses without permission.</li>
              <li>Script around the hourly caps, for example by rotating addresses or IPs to drain the faucet.</li>
              <li>Submit certs or data you know to be false, or try to vault a card that is not yours.</li>
              <li>Use {brand} to launder funds, evade sanctions or break the law where you are.</li>
              <li>Copy the site's design or name to impersonate {brand} or mislead people.</li>
              <li>Manipulate a market with wash trades or spoofed orders to mislead other traders.</li>
            </ul>
          </Prose>
        </Section>
        <Section id="limits" title="Hourly caps">
          <Prose>
            <p>Every sponsored action costs {brand} gas, so each is capped per visitor and overall. A request over a cap is refused with a plain message and costs nothing.</p>
          </Prose>
          <KeyValue
            items={[
              ['Vault check-in', '12 per visitor, 40 overall'],
              ['Custody confirmation', '20 per visitor, 60 overall'],
              ['Test gas', '8 per visitor, plus one top-up per address every two minutes and an overall hourly limit'],
              ['Private-vault saves', '12 per vault, 40 per visitor, 120 overall'],
            ]}
          />
        </Section>
        <Section id="permissionless" title="The contracts are permissionless">
          <Prose>
            <p>Anyone can call the vault and the order books directly with their own tools, and this policy cannot stop that. What happens on chain is governed by the contracts' own rules and by the law where you are.</p>
          </Prose>
        </Section>
        <Section id="enforcement" title="What happens if it is broken">
          <Prose>
            <p>{brand} may block access to its website and relay services for anyone who breaks this policy. It cannot freeze a token or reverse a trade, because the contracts do not allow it.</p>
          </Prose>
        </Section>
      </>
    ),
  },
  'market-data': {
    standfirst: `Where the prices on ${brand} come from, what they are, and the several things they are not.`,
    body: () => (
      <>
        <Callout tone="caution" title="The short version"><p>Every price on {brand} comes from orders on its own on-chain books.{test ? ` On the test network most of those orders come from ${brand}'s market maker.` : ''} No price here is an appraisal or a valuation of any card.</p></Callout>
        <Section id="sources" title="Where each number comes from">
          <KeyValue
            items={[
              ['Ask and best offer', 'The lowest sell order and highest buy order resting on the card\'s Kuru book, read from the chain.'],
              ['Last sale', 'The price of the most recent fill on that book, from the Envio indexer.'],
              ['Price history', 'Every fill on the book, grouped into candles by the app.'],
              ['Traded, 30 days', 'The sum of fills over the last thirty days, from the indexer.'],
              ['Vault value', 'Each vaulted slab priced at its book\'s best offer, added up.'],
              ['Spread', 'The gap between the ask and the best offer.'],
            ]}
          />
        </Section>
        <Section id="not" title="What a price is not">
          <Prose>
            <ul>
              <li>It is not a price from PSA, a grading service, an auction house or a price guide. {brand} uses no outside price feed.</li>
              <li>It is not an offer by {brand} to buy or sell at that price.</li>
              <li>A thin book can show a price far from what a card sells for elsewhere.</li>
              {test && <li>On the test network the market maker quotes every card around a demo reference price with its own spread and drift, so prices are illustrative.</li>}
            </ul>
          </Prose>
        </Section>
        <Section id="ownership" title="Names and pictures">
          <Prose>
            <p>Card names, set names, player names, artwork and grading marks belong to their owners and appear only to identify the card. Picture sources are on the <A href="/legal/credits">credits page</A>.</p>
          </Prose>
        </Section>
        <Section id="reuse" title="Using the data">
          <Prose>
            <p>The trades and orders are public chain data and anyone may read them. The indexer endpoint is open for reasonable use. Please do not present {test ? 'test network ' : ''}prices from {brand} as market valuations.</p>
          </Prose>
        </Section>
      </>
    ),
  },
  ai: {
    standfirst: `How AI is and is not part of ${brand}. There is no language model inside the product.`,
    body: () => (
      <>
        <Section id="product" title="No model in the product">
          <Prose>
            <p>Nothing you read in the app or on these pages is generated at the moment you read it. Prices, balances and receipts come from the chain and the indexer, and every sentence was written ahead of time.</p>
          </Prose>
        </Section>
        <Section id="agents" title="AI agents that trade">
          <Prose>
            <p>The <A href="/docs/agent-plugin">Agent Wallet plugin</A> lets an AI agent read {brand}'s books and rest bids through the MetaMask Agent Wallet. The agent acts for whoever runs it, signing goes through that person's wallet and its policies, and the person is responsible for what the agent does. The plugin can only rest a post-only bid. It can never take the ask.</p>
          </Prose>
        </Section>
        <Section id="building" title="How it was built">
          <Prose>
            <p>AI coding tools, mainly Claude Code from Anthropic, helped write {brand}'s code, tests, interface and documentation. The design, the decisions, the review and the testing are the founder's, and every claim on the site is checked against the code and live chain data. The same disclosure is in the <A href={`${REPO}#use-of-ai-coding-tools`}>repository README</A>.</p>
          </Prose>
        </Section>
      </>
    ),
  },
}

export function LegalDoc({ slug }: { slug: string }) {
  const meta = legalBySlug(slug)
  const doc = DOCS[slug]
  if (!meta || !doc) return <NotFound />
  return (
    <DocumentLayout
      eyebrow="Legal"
      title={meta.title}
      standfirst={doc.standfirst}
      crumbs={[[brand, '/'], ['Legal', '/legal'], [meta.title]]}
      meta={[['Updated', date(meta.updated)]]}
      actions={<PrintButton />}
      after={<Related title="Other documents" links={LEGAL.filter((l) => l.slug !== slug).map((l) => [l.title, legalHref(l.slug), l.summary] as [string, string, string])} />}
    >
      {doc.body()}
    </DocumentLayout>
  )
}

export function NotFound() {
  return (
    <PublicPage>
      <header className="pub-head pub-404">
        <span className="pub-eyebrow accent">404</span>
        <h1>Page not found</h1>
        <p className="pub-standfirst">This address does not match a page on {brand}. The link may be old or mistyped.</p>
        <p className="pub-404-links">
          <a className="btn md" href="/markets">Open Markets</a>
          <a className="ghost line md" href="/docs">Read the docs</a>
        </p>
      </header>
    </PublicPage>
  )
}
