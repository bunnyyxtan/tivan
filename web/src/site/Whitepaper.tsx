import { brand, net } from '../config'
import { A, Callout, DocumentLayout, KeyValue, PrintButton, Prose, Related, Section } from './Layout'
import { REPO, docHref } from './siteMap'

// The design document. It describes the contracts and services as they run today, states the trust assumptions, and
// keeps plans in the future tense so nothing planned reads as shipped.
const test = net.name === 'testnet'

export function WhitepaperPage() {
  return (
    <DocumentLayout
      eyebrow="Design document"
      title={`${brand}: an exchange for graded cards on Monad`}
      standfirst="A market where every card and grade is one fungible token with its own on-chain order book, backed by vaulted slabs and redeemable for the physical card. This document describes the mechanism, states its trust assumptions and lists what it does not do yet."
      crumbs={[[brand, '/'], ['Whitepaper']]}
      meta={[['Version', '1.0'], ['Date', '11 October 2026'], ['Network', `${net.chain.name}, chain ${net.chain.id}`]]}
      actions={<PrintButton />}
      after={
        <Related
          links={[
            ['Documentation', '/docs', 'The mechanism at working depth, one page per subject.'],
            ['Contracts', '/contracts', 'Addresses and roles, linked to the explorer.'],
            ['Security', '/security', 'The trust model and how to report a problem.'],
            ['Risk disclosure', '/legal/risk', 'What can go wrong, stated plainly.'],
          ]}
        />
      }
    >
      <Callout tone="caution" title="Status of this document">
        <p>This describes a running {test ? 'test network ' : ''}deployment, not a finished product. Plans are written as plans. {test ? 'On the test network nothing has money value and custody is simulated.' : ''}</p>
      </Callout>

      <Section id="abstract" title="1. Abstract">
        <Prose>
          <p>{brand} is an exchange for graded trading cards. Each card at each grade, for example PSA 10 Base Set Charizard Holo, is one ERC-20 token with zero decimals, so a token is always one whole card. All vaulted copies of that card and grade back the same token, and the token trades on its own Kuru central limit order book on Monad, priced in dollars. A holder can redeem a token for the oldest vaulted copy at any time.</p>
          <p>The system is a vault contract, a grade verification path that takes every grade from the grader's registry, a custodian, one order book per card and grade, passkey accounts, and an indexer. The rest of this document describes each part and where trust still sits.</p>
        </Prose>
      </Section>

      <Section id="problem" title="2. The problem">
        <Prose>
          <p>Graded cards are some of the most standardised collectibles there are. A grade is a published scale and a cert number is a public record. Yet they trade like one-off objects. Marketplaces list each slab separately, so there is no standing bid for "any PSA 10 Charizard", only a scatter of asking prices and a wait. Fees on the large marketplaces run to the low teens as a percentage of the sale, and a price is only discovered when someone happens to accept one.</p>
          <p>Tokenised card platforms mostly repeat the pattern on chain, one NFT per slab. The unit is still the individual object, so liquidity stays split across thousands of near-identical items.</p>
        </Prose>
      </Section>

      <Section id="design" title="3. The design">
        <Prose>
          <p>{brand} makes the grade the unit. Collectors already price two slabs of the same card at the same grade as the same item, so the market treats them that way too. One token per card and grade concentrates every buyer and seller of that item into one book, which gives a live bid, a live ask, a spread and a public trade history.</p>
          <p>Each book needs trades to be cheap and final in about a second. On Monad a trade settles in under a second at a fee of a fraction of a cent, which makes an on-chain book per card practical. In passkey runs on the test network, buys settled in 0.7 to 0.9 seconds.</p>
        </Prose>
      </Section>

      <Section id="vault" title="4. The vault">
        <Prose>
          <p>SlabVault holds the custody logic. A card and grade is identified by its SKU, the hash of the grader's specification id and the grade. Each cert moves through four states.</p>
        </Prose>
        <KeyValue
          items={[
            ['None', 'The vault has never seen the cert.'],
            ['Attested', 'The attestor recorded it after checking the registry. A cert can be attested once.'],
            ['Vaulted', 'The custodian confirmed the slab. One token was minted to the depositor and the cert joined the SKU\'s queue.'],
            ['Redeemed', 'A holder burned a token and claimed this copy.'],
          ]}
        />
        <Prose>
          <p>The attestor and custodian are fixed when the vault is deployed. Redemption and market linking are open to anyone, under the vault's own checks.</p>
        </Prose>
      </Section>

      <Section id="listing" title="5. Listing and markets">
        <Prose>
          <p>The first attest of a new SKU deploys its token and, in the same transaction, a Kuru order book through the Kuru router. Every book uses the same parameters, set at deployment and read back from the router by the app.</p>
        </Prose>
        <KeyValue items={[['Base', 'The card token, whole cards'], ['Quote', test ? 'TestUSD, standing in for USDC' : 'USDC'], ['Price precision', 'Cents'], ['Tick', '1 cent'], ['Order size', '1 to 1,000 cards'], ['Fees', 'Read per book, currently 0% maker and taker']]} />
        <Prose>
          <p>Where the router gates deployment, as Kuru does on Monad mainnet, the vault lists the token without a book. Anyone can later attach a book Kuru deploys with linkMarket, and the vault accepts it only if the router reports this token as its base and the vault's dollar as its quote. On 10 October 2026 Kuru said it does not deploy mainnet markets for security reasons, so trading runs on the test network, where deployment is open.</p>
        </Prose>
      </Section>

      <Section id="verification" title="6. Grade verification">
        <Prose>
          <p>A token is only as honest as the grade behind it, so the grade never comes from the depositor. The cert number is looked up in the grader's registry, and the specification and grade in the response are what the vault records.</p>
          <p>The check is built as a Chainlink CRE workflow. Each node of the oracle network fetches the cert, the nodes agree on one result, and the forwarder delivers the signed report to GradeOracle on Monad. The attestor treats a GradeOracle record as the source of truth and performs the same registry check itself when none exists. CRE does not yet write to Monad in production, so today the workflow runs in simulation and the relay performs the live check. See <A href={docHref('verification')}>Grade verification</A>.</p>
        </Prose>
      </Section>

      <Section id="custody" title="7. Custody and redemption">
        <Prose>
          <p>A token exists only after the custodian confirms the slab is in the vault. Redemption burns one token and releases the oldest vaulted copy of that SKU, first in, first out. Holders cannot pick the best-centred copy, which keeps every token worth the same. Only a hash of the shipping details goes on chain.</p>
          <p>Copies within a grade still differ in centring and eye appeal. FIFO redemption and a list focused on liquid, well-known cards limit that difference. They do not remove it.</p>
        </Prose>
      </Section>

      <Section id="accounts" title="8. Accounts">
        <Prose>
          <p>Accounts are passkeys, through Mera. The WebAuthn PRF extension returns the same secret each time the same passkey signs in, and that secret is the account's private key. There is no seed phrase, extension or server-side wallet. A session keeps the key for up to seven days, encrypted with a browser key that cannot be exported, and any buy over $1,000 asks for the passkey again.</p>
          <p>A private vault stores a holder's watchlist, alerts and notes on chain as ciphertext in SealedBox, sealed with keys the passkey rebuilds on any device.</p>
        </Prose>
      </Section>

      <Section id="data" title="9. Data">
        <Prose>
          <p>An Envio HyperIndex indexer follows the vault and registers each book as it is listed. It serves markets, trades, daily volume, orders, certs and Chainlink grade checks over GraphQL. Without it the app reads the vault and books straight from the chain, so trading never depends on the indexer.</p>
        </Prose>
      </Section>

      <Section id="economics" title="10. Economics">
        <Prose>
          <p>Trading fees are 0% today. The plan is a taker fee well below the low-teens percentage of the large marketplaces, a fee for vaulting and for redemption that covers handling and insurance, and revenue from liquidity {brand} provides on new books until outside market makers arrive. Each fee will be set in the contracts and shown on every review screen before anyone confirms.</p>
        </Prose>
      </Section>

      <Section id="trust" title="11. Trust model and limits">
        <Prose>
          <ul>
            <li>One key is attestor and custodian{test ? ' on the test network' : ''}. A production custodian will confirm only after receiving and inspecting the slab.</li>
            <li>GradeOracle trusts its configured forwarder. A production workflow will also pin its workflow id and owner.</li>
            <li>The contracts have not been audited.</li>
            {test && <li>Custody is simulated, certs come from a demo registry, and prices come from {brand}'s own market maker.</li>}
            <li>There are no mainnet order books while Kuru does not deploy them.</li>
          </ul>
        </Prose>
      </Section>

      <Section id="next" title="12. What comes next">
        <Prose>
          <ul>
            <li>A licensed vault partner that receives and inspects each slab before custody is confirmed.</li>
            <li>The live grader API in place of the demo registry, and the CRE workflow writing to Monad once Chainlink supports it.</li>
            <li>An audit before any real value is held.</li>
            <li>Mainnet books, deployed by Kuru or through another venue that supports permissionless listing.</li>
          </ul>
          <p>The code for everything above is open in the <A href={REPO}>repository</A>.</p>
        </Prose>
      </Section>
    </DocumentLayout>
  )
}
