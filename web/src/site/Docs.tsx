import type { ReactNode } from 'react'
import { brand, indexerUrl, net } from '../config'
import { A, Callout, Code, DocsLayout, KeyValue, Prose, Section } from './Layout'
import { DOC_GROUPS, DOCS, docBySlug, docHref } from './siteMap'
import { NotFound } from './Legal'

// The documentation, one entry per slug in siteMap.DOCS. Every figure is read from the code or the chain: market rules
// from the vault's Kuru parameters, thresholds from the app, addresses from config.
const test = net.name === 'testnet'

const PAGES: Record<string, () => ReactNode> = {
  'how-it-works': () => (
    <>
      <Section id="idea" title="The idea">
        <Prose>
          <p>Card platforms usually list every graded slab as its own one-off item, so two PSA 10 Charizards are two separate listings and nobody can bid for "any PSA 10 Charizard". {brand} makes the grade the unit. Every vaulted copy of one card at one grade backs the same token, and that token trades on one order book with a live bid, a live ask and a public price history.</p>
        </Prose>
      </Section>
      <Section id="parts" title="The parts">
        <Prose>
          <ul>
            <li><b>SlabVault</b> is the contract at the centre. It records each grading cert, mints and burns the card tokens, and deploys each card's order book. See <A href="/contracts">Contracts</A>.</li>
            <li><b>Card tokens</b> are ERC-20 tokens with zero decimals, one per card and grade, so a token is always a whole card.</li>
            <li><b>Order books</b> are Kuru central limit order books on Monad, one per card and grade, priced in dollars. See <A href={docHref('order-books')}>Order books and prices</A>.</li>
            <li><b>Verification</b> takes the card and grade from the grader's registry, never from the depositor. See <A href={docHref('verification')}>Grade verification</A>.</li>
            <li><b>Accounts</b> are passkeys. There is no seed phrase and no browser extension. See <A href={docHref('passkeys')}>Passkey accounts</A>.</li>
            <li><b>Data</b> for charts, trades and open orders comes from an Envio indexer that follows the vault and every book. See <A href={docHref('data')}>Indexer and data</A>.</li>
          </ul>
        </Prose>
      </Section>
      <Section id="lifecycle" title="The life of a card">
        <Prose>
          <ol>
            <li><b>Attest.</b> A depositor submits a cert number. The grade is checked against the registry and the vault records the cert.</li>
            <li><b>List.</b> The first cert of a new card and grade deploys that card's token and its order book in the same transaction.</li>
            <li><b>Custody.</b> The custodian confirms the slab is in the vault, and one token is minted to the depositor.</li>
            <li><b>Trade.</b> Anyone buys, sells, rests offers and lists on the book. Each trade settles on Monad in about a second.</li>
            <li><b>Redeem.</b> A holder burns one token and the vault releases the oldest copy of that card and grade.</li>
          </ol>
        </Prose>
      </Section>
      {test && (
        <Callout tone="caution" title="On the test network">
          <p>Dollars are a test token, custody is simulated and no physical card ships. Prices come from an automated market maker run by {brand}. Read the <A href="/legal/testnet">testnet disclosure</A>.</p>
        </Callout>
      )}
    </>
  ),

  'getting-started': () => (
    <>
      <Section id="account" title="Create an account">
        <Prose>
          <p>Open <A href="/you">Account</A> and choose Continue with a passkey. Your device asks for your fingerprint, face or screen lock, and the passkey it creates becomes your account. Browsing needs no account at all, so you can look around first.</p>
          <p>Your passkey manager needs to support the WebAuthn PRF extension. Most current ones do, including iCloud Keychain and Google Password Manager. If yours does not, the app says so before anything is created.</p>
        </Prose>
      </Section>
      {test && (
        <Section id="cash" title="Add test dollars">
          <Prose>
            <p>Open Cash from the header and add test dollars. They are minted to your address by an open test token, so they cost nothing and have no value. You can add more whenever you run low.</p>
          </Prose>
        </Section>
      )}
      <Section id="gas" title="Network fees">
        <Prose>
          <p>Every action is a transaction on Monad and the network charges a small fee in MON, about 0.02 MON per transaction.{test ? ' A new account is sent a little test MON automatically, and it is topped up again when it runs low, at most once every two minutes.' : ''}</p>
        </Prose>
      </Section>
      <Section id="next" title="Next">
        <Prose>
          <p>Make <A href={docHref('first-trade')}>your first trade</A>, or read <A href={docHref('how-it-works')}>how {brand} works</A> first.</p>
        </Prose>
      </Section>
    </>
  ),

  'first-trade': () => (
    <>
      <Section id="pick" title="Pick a card">
        <Prose>
          <p>Open <A href="/markets">Markets</A> and choose a card. Its page shows the lowest ask, the best offer and the spread between them, with the price history and the full order book below.</p>
        </Prose>
      </Section>
      <Section id="buy" title="Buy at the ask">
        <Prose>
          <p>Choose Buy now. The review screen shows the total you pay, the trading fee and the network fee before you confirm. The order is fill or kill with a price limit, so if the ask moves before it fills, nothing is charged.</p>
          <p>Buys of more than $1,000 ask for your passkey again before they are sent. Smaller ones go straight through while your session is active.</p>
        </Prose>
      </Section>
      <Section id="receipt" title="Read the receipt">
        <Prose>
          <p>When the trade settles you see how long it took, the block it landed in and a link to the transaction on the Monad explorer. The card is now in your Portfolio, still held in the vault for you.</p>
        </Prose>
      </Section>
    </>
  ),

  glossary: () => (
    <Section id="terms" title="Terms">
      <KeyValue
        items={[
          ['Ask', 'The lowest price anyone is selling at right now.'],
          ['Best offer', 'The highest price anyone is bidding right now. Also called the bid.'],
          ['Spread', 'The gap between the ask and the best offer.'],
          ['Card and grade', 'One card at one grade from one grader, for example PSA 10 Base Set Charizard Holo. The unit that has a token and a book.'],
          ['Slab', 'A graded card sealed in the grader\'s plastic case with its label and cert number.'],
          ['Cert', 'The grader\'s certificate number printed on the slab label, used to look the slab up in the registry.'],
          ['Attest', 'Recording a verified cert in the vault. The first attest of a new card and grade also lists its market.'],
          ['Custody', 'The vault holding the physical slab. Confirming custody mints one token.'],
          ['Redeem', 'Burning one token to claim the oldest vaulted copy of that card and grade.'],
          ['Offer', 'A buy order resting on the book below the ask, waiting for a seller.'],
          ['Listing', 'A sell order resting on the book above the best offer, waiting for a buyer.'],
          ['Fill or kill', 'An order that fills completely at your limit or not at all.'],
          ['Passkey', 'A sign-in credential kept by your device. On Tivan it is also your account key.'],
          ['MON', 'The Monad network\'s currency, used to pay network fees.'],
        ]}
      />
    </Section>
  ),

  'order-books': () => (
    <>
      <Section id="one-book" title="One book per card and grade">
        <Prose>
          <p>Every card and grade has its own Kuru central limit order book, deployed by SlabVault when that card's first cert is attested. Orders match by price, then by time. There is no pool and no curve setting the price, only the orders people place.</p>
        </Prose>
      </Section>
      <Section id="units" title="Prices and sizes">
        <KeyValue
          items={[
            ['Quote currency', test ? 'TestUSD, a test stand-in for USDC with 6 decimals' : 'USDC on Monad'],
            ['Price precision', 'Whole cents'],
            ['Size precision', 'Whole cards'],
            ['Tick', '1 cent'],
            ['Order size', 'From 1 to 1,000 cards'],
          ]}
        />
        <Prose>
          <p>These rules are read from the book's own contract through the Kuru router every time, never assumed by the app.</p>
        </Prose>
      </Section>
      <Section id="fees" title="Fees">
        <Prose>
          <p>The trading fee is set per book in the contract and is currently 0% for takers and makers. The review screen always shows the fee for that order before you confirm. Network fees in MON are separate.</p>
        </Prose>
      </Section>
      <Section id="cash" title="Where your cash sits">
        <Prose>
          <p>Kuru keeps trading balances in its margin account. Buying moves dollars there first, and a sale credits it. The app shows both your wallet and your exchange balance, and withdrawing back to your wallet is one transaction.</p>
        </Prose>
      </Section>
      <Section id="spot-v2" title="Kuru Spot V2">
        <Prose>
          <p>Kuru's newer Spot V2 contracts keep cash and tokens in AccountCore, under one numeric account per owner, and every market is an OrderBook settling against Kuru's own test USDC. Creating a V2 market and enabling a token are permissioned, so each card's V2 book is deployed by Kuru with the parameters below, and a card shows its V2 panel only once that book exists.</p>
          <p>Tivan finds those books by itself. For every card token it asks the V2 router for the address a market with these parameters would have, and checks the router has verified it. A card with a V2 book shows a Kuru Spot V2 panel on its page, beside its original book, with Buy now, Sell now, Make an offer and List. The panel moves cash and cards into Kuru only when an order needs them, and moves them back to the wallet in one tap.</p>
        </Prose>
        <KeyValue
          items={[
            ['Price precision', '100, so prices are in cents'],
            ['Size precision', '1, so one token is one whole card'],
            ['Tick', '1 cent'],
            ['Order value', '1 USDC to 5,000,000 USDC'],
            ['Fees', '0 maker and taker'],
            ['Passive spread', '10 ticks'],
          ]}
        />
        <Prose>
          <p>Kuru's test USDC can only be minted by Kuru, so Tivan's relay hands each new account a fixed amount once.</p>
        </Prose>
      </Section>
    </>
  ),

  selling: () => (
    <>
      <Section id="offer" title="Make an offer">
        <Prose>
          <p>Make an offer rests a buy order below the ask. It waits on the book until a seller fills it or you cancel. Offers are post only, so an offer at or above the ask is refused rather than filled at a worse price than you meant.</p>
        </Prose>
      </Section>
      <Section id="sell-now" title="Sell now">
        <Prose>
          <p>Sell now sells into the best offers on the book straight away. Like buying, it is fill or kill with a floor price, so if the offers drop before it fills, nothing is sold.</p>
        </Prose>
      </Section>
      <Section id="list" title="List at your price">
        <Prose>
          <p>List rests a sell order at a price you choose and waits for a buyer. The card moves to your exchange balance while it is listed and is free to sell or withdraw again once you cancel.</p>
        </Prose>
      </Section>
      <Section id="cancel" title="Cancel">
        <Prose>
          <p>Cancelling is an on-chain transaction, so it is final once it lands and you can see it in Activity. Undo on a fresh order does the same thing.</p>
        </Prose>
      </Section>
    </>
  ),

  vaulting: () => (
    <>
      <Section id="steps" title="Steps">
        <Prose>
          <ol>
            <li>Open <A href="/vault">Vault a card</A> and enter the cert number from the slab label.</li>
            <li>The grade is looked up in the grader registry and shown to you. Confirm that this is your card.</li>
            <li>The attestor records the cert in the vault. If this is the first copy of that card and grade, its token and order book are created in the same transaction.</li>
            <li>The custodian confirms the slab is in the vault, and one token is minted to your account.</li>
          </ol>
        </Prose>
      </Section>
      <Section id="rules" title="What the vault enforces">
        <Prose>
          <ul>
            <li>Only the attestor can record a cert, and only the custodian can confirm custody.</li>
            <li>A cert can be recorded once. A second attempt reverts.</li>
            <li>The card and grade come from the registry response, never from what the depositor typed.</li>
          </ul>
        </Prose>
      </Section>
      {test && (
        <Callout tone="caution" title="Simulated on the test network">
          <p>One team key acts as both attestor and custodian, and custody is confirmed without a physical slab. In production the custodian confirms only after receiving and inspecting the slab. Certs come from demo fixtures shaped like PSA responses.</p>
        </Callout>
      )}
    </>
  ),

  verification: () => (
    <>
      <Section id="principle" title="The grade comes from the registry">
        <Prose>
          <p>A token is only as good as the grade behind it, so {brand} never takes the grade from the person depositing. The cert number is looked up in the grader's registry and the specification and grade in the response are what the vault records.</p>
        </Prose>
      </Section>
      <Section id="cre" title="The Chainlink CRE workflow">
        <Prose>
          <p>The workflow named slab-attest runs on the Chainlink Runtime Environment. Each node of the oracle network fetches the cert from the registry, the nodes agree on one result, and the forwarder delivers the signed report to the GradeOracle contract on Monad.</p>
          <p>When GradeOracle holds a record for a cert, the attestor uses it as the source of truth. Otherwise the attestor performs the same registry check itself. Certs verified through CRE carry a Chainlink mark in each card's Vault and verification section.</p>
        </Prose>
      </Section>
      <Section id="limits" title="Limits today">
        <Prose>
          <ul>
            <li>Chainlink CRE does not yet write to Monad in production, so the workflow runs in simulation and the attestor relay performs the live check.</li>
            <li>The registry is a demo registry shaped like PSA's API. The PSA code path exists and is tested against mocks.</li>
            <li>GradeOracle trusts its configured forwarder. A production deployment should also pin the workflow ID and owner.</li>
          </ul>
        </Prose>
      </Section>
    </>
  ),

  redemption: () => (
    <>
      <Section id="how" title="How it works">
        <Prose>
          <p>Request the card from its page or your Portfolio. One token is burned and the vault releases the oldest vaulted copy of that card and grade. Copies leave in the order they arrived, so nobody can pick out the best-centred slab.</p>
        </Prose>
      </Section>
      <Section id="privacy" title="Shipping details stay off chain">
        <Prose>
          <p>Only a hash of the shipping details is recorded on chain, as a commitment the vault partner can check. The details themselves are never published.</p>
        </Prose>
      </Section>
      {test && (
        <Callout tone="caution" title="On the test network">
          <p>Redeeming records the request on chain and retires the token, but no physical card is held, so nothing ships.</p>
        </Callout>
      )}
    </>
  ),

  passkeys: () => (
    <>
      <Section id="key" title="Your passkey is your key">
        <Prose>
          <p>{brand} uses Mera to turn a passkey into a Monad account. The WebAuthn PRF extension gives the same secret every time the same passkey signs in, and that secret is the account's private key. Nothing is stored on a server, and the same passkey opens the same account on any device it syncs to.</p>
        </Prose>
      </Section>
      <Section id="session" title="Sessions">
        <Prose>
          <p>After you sign in, the key is kept in the browser for up to seven days so a refresh does not ask again. It is encrypted with a browser key that cannot be exported, and it is deleted when the session ends or you sign out. Buys over $1,000 always ask for the passkey again.</p>
        </Prose>
      </Section>
      <Section id="backup" title="Back up your key">
        <Prose>
          <p>Account lets you export your private key after a fresh passkey check. Store it somewhere safe. Anyone who holds it controls your account, and if every copy of your passkey is lost, it is the only way back in.</p>
        </Prose>
      </Section>
    </>
  ),

  'private-vault': () => (
    <>
      <Section id="what" title="What it is">
        <Prose>
          <p>The private vault keeps your watchlist, alerts and notes sealed so that only your passkey can open them, on any device. It is stored on Monad in the SealedBox contract as ciphertext.</p>
        </Prose>
      </Section>
      <Section id="how" title="How it is sealed">
        <Prose>
          <p>One passkey check under the vault's own salt gives three keys through HKDF. An AES key seals the data, a locator says where it lives, and a keeper key signs each write. None of them is stored, because the passkey rebuilds all three.</p>
          <p>The keeper key is separate from your trading account, so the box is not linked to your address on chain. {brand}'s relay pays the gas for writes, but it can only submit what your keeper signed, and each write carries a nonce so it cannot be replayed.</p>
        </Prose>
      </Section>
    </>
  ),

  'agent-plugin': () => (
    <>
      <Section id="what" title="What it does">
        <Prose>
          <p>The plugin adds three commands to the MetaMask Agent Wallet. It finds every market from the indexer and reads each book over a public RPC, so new cards appear without a plugin update. It holds no keys.</p>
        </Prose>
        <Code label="Commands">{`mm tivan markets             # every card, its id, ask and best offer
mm tivan orders <address>     # orders still resting on the books
mm tivan buy CHZ10 --price 4800 --size 1   # rest a bid, signed by the Agent Wallet`}</Code>
      </Section>
      <Section id="safety" title="Safety">
        <Prose>
          <ul>
            <li>The two read commands need no capability at all.</li>
            <li>Buy only rests a post-only bid. It can never take the ask, and a bid at or above the ask is refused before the wallet is asked.</li>
            <li>Signing, spending policy and MFA are the Agent Wallet's own, unchanged.</li>
          </ul>
        </Prose>
      </Section>
      <Section id="install" title="Install">
        <Code label="From the repository">{`cd plugins/tivan && npm install && npm run build
mm config set experimentalPlugins true
mm plugins install "file:$PWD" --accept-permissions`}</Code>
        <Prose>
          <p>Full instructions are in the <A href="https://github.com/bunnyyxtan/tivan/tree/main/plugins/tivan">plugin README</A>.</p>
        </Prose>
      </Section>
    </>
  ),

  data: () => (
    <>
      <Section id="indexer" title="The indexer">
        <Prose>
          <p>An Envio HyperIndex indexer follows the vault and registers each new order book as it is listed, so it needs no list of cards. It serves markets, trades, daily volume, orders, certs and Chainlink grade checks over GraphQL.</p>
        </Prose>
        {indexerUrl && <KeyValue items={[['Endpoint', <span className="mono" key="u">{indexerUrl}</span>]]} />}
      </Section>
      <Section id="examples" title="Example queries">
        <Code label="Every market with its last sale">{`{ Market(order_by: { listedAt: asc }) { id name lastPriceCents } }`}</Code>
        <Code label="The latest trades">{`{ Trade(order_by: { timestamp: desc }, limit: 10) {
    priceCents sizeCards takerBuy timestamp txHash market { name }
} }`}</Code>
      </Section>
      <Section id="fallback" title="When the indexer is down">
        <Prose>
          <p>The app reads the vault and books straight from the chain if the indexer does not answer, so markets and prices keep working. Price history then covers recent blocks only.</p>
        </Prose>
      </Section>
    </>
  ),
}

export function DocsIndex() {
  return (
    <DocsLayout slug="" title="Documentation" standfirst={`How ${brand} works, how to use it, and how to build on it.`}>
      {DOC_GROUPS.map((g) => (
        <section key={g.id} id={g.id} className="pub-sec">
          <h2>{g.title}</h2>
          <div className="pub-cards">
            {DOCS.filter((d) => d.group === g.id).map((d) => (
              <a key={d.slug} href={docHref(d.slug)} className="pub-card">
                <b>{d.title}</b>
                <small>{d.summary}</small>
              </a>
            ))}
          </div>
        </section>
      ))}
    </DocsLayout>
  )
}

export function DocPage({ slug }: { slug: string }) {
  const d = docBySlug(slug)
  const body = PAGES[slug]
  if (!d || !body) return <NotFound />
  return (
    <DocsLayout slug={slug} title={d.title} standfirst={d.summary}>
      {body()}
    </DocsLayout>
  )
}
