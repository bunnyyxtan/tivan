import { brand, net } from '../config'
import { A, Callout, DocumentLayout, KeyValue, PrintButton, Prose, Related, Section } from './Layout'
import { docHref } from './siteMap'

// How Tivan intends to earn. Nothing here is charged today, so every rate is written as a plan and the page says so at
// the top. The structure matters more than the rates: custody and credit scale with what is vaulted, not with volume.
const test = net.name === 'testnet'

const LINES: [line: string, rate: string, base: string, what: string][] = [
  ['Custody', '50 bps a year', 'Insured value held', 'Billed monthly from the account while a slab is in the vault. It is charged whether or not the card ever trades, the way a bullion vault charges for metal.'],
  ['Trading', '100 bps taker, 0 maker', 'Value of each fill', 'Taken by the order book itself, in the contract, on every fill. Makers pay nothing so outside firms have a reason to quote.'],
  ['Vaulting and redemption', 'Flat per slab', 'Each slab in or out', 'Covers intake, inspection, storage handling, and shipping and insurance on the way back out. Cost recovery, not margin.'],
  ['Credit', '300 bps of the spread', 'Value borrowed', `Lenders deposit dollars, holders borrow against a vaulted slab, and ${brand} keeps the difference between the two rates plus a fee on any liquidation.`],
]

export function EconomicsPage() {
  return (
    <DocumentLayout
      eyebrow="Business"
      title="How Tivan earns"
      standfirst="Every other card marketplace taxes the transaction. Tivan holds the card and knows what it is worth right now, so it can earn from the asset standing still. This page sets out the four revenue lines, the rates intended for each, and what has to be true before any of them is switched on."
      crumbs={[[brand, '/'], ['How Tivan earns']]}
      meta={[['Version', '1.0'], ['Date', '11 October 2026'], ['Charged today', 'Nothing']]}
      actions={<PrintButton />}
      after={
        <Related
          links={[
            ['Whitepaper', '/whitepaper', 'The mechanism these fees sit on top of.'],
            ['Order books and prices', docHref('order-books'), 'Where a fee is read from and how it is shown before you confirm.'],
            ['Vaulting a card', docHref('vaulting'), 'What custody actually involves, step by step.'],
            ['Risk disclosure', '/legal/risk', 'The ways this can go wrong, stated plainly.'],
          ]}
        />
      }
    >
      <Callout tone="caution" title="Nothing is charged today">
        <p>
          Every book {brand} has deployed runs at zero taker and zero maker fees, custody is free, and there is no lending. The rates below are the intended ones and none of them is live
          {test ? ' on the test network' : ''}. Each book takes its fees as parameters when the vault deploys it, so turning a fee on sets a number on new books rather than replacing a contract, and the rate in force is always read from the book itself and shown on the review screen before anyone confirms.
        </p>
      </Callout>

      <Section id="idea" title="1. The thing worth charging for">
        <Prose>
          <p>
            A graded card is an illiquid asset with no price. There are comparable sales weeks old, a population report, and an auction that takes a month to settle. The holder cannot sell quickly, cannot borrow against it without a pawn shop, and cannot find out what it is worth this afternoon without putting it up for sale.
          </p>
          <p>
            Tivan changes three things about that card at once. It is held in a vault, so there is something real behind the token. Its grade is attested on chain by a Chainlink workflow rather than typed in by the depositor, so a contract can read what it is. And it has its own order book, so there is a live bid on that exact card at that exact grade, with depth behind it.
          </p>
          <p>
            A live bid on an asset someone else is holding for you is the raw material for credit, and it is the part nobody else in collectibles has. That is why the revenue below does not stop at a trading fee. The trading fee is the smallest of the four lines and the easiest for a competitor to undercut. Custody and credit are the ones that compound.
          </p>
        </Prose>
      </Section>

      <Section id="lines" title="2. The four lines">
        <div className="pub-table-wrap">
          <table className="pub-table">
            <thead>
              <tr><th>Line</th><th>Intended rate</th><th>Charged on</th><th>How it works</th></tr>
            </thead>
            <tbody>
              {LINES.map(([line, rate, base, what]) => (
                <tr key={line}>
                  <td><b>{line}</b></td>
                  <td className="mono">{rate}</td>
                  <td>{base}</td>
                  <td>{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Prose>
          <p>
            A fifth line exists for as long as {brand} is the only firm quoting a new book, since the vault opens a book the moment a card is first vaulted and somebody has to make the first market. That spread is real revenue in the first year and it should fall to nothing as outside makers arrive. It is a bridge, not a pillar, and counting it as permanent would mean planning to trade against the people using the exchange.
          </p>
        </Prose>
      </Section>

      <Section id="why" title="3. Why custody carries the model">
        <Prose>
          <p>
            A take rate is a discount war. The large card marketplaces charge somewhere in the low teens once the seller fee, the buyer premium and payment processing are counted, so 100 bps is a strong line on a landing page, and it is also a number any competitor can halve the following week. It earns nothing until volume arrives, and volume churns.
          </p>
          <p>
            Custody does not behave that way. A collector who vaults a card and does not touch it for three years is paying the whole time, and is usually glad to, because a safe deposit box and a rider on a home insurance policy already cost more than this. Nobody can undercut it by much either, because the physical card has to be shipped, inspected and re-vaulted to move, which is slow and expensive in a way that switching exchanges is not.
          </p>
          <p>
            So the number that matters for {brand} is not volume. It is the insured value sitting in the vault, and both the custody fee and the credit spread scale with it directly. One input to grow, everything else a multiplier on it.
          </p>
        </Prose>
      </Section>

      <Section id="shape" title="4. The shape at two sizes">
        <Prose>
          <p>Illustrative, at the rates above, with an average slab of $2,000 and inventory turning over one and a half times a year.</p>
        </Prose>
        <div className="pub-table-wrap">
          <table className="pub-table">
            <thead>
              <tr><th>Line</th><th className="mono">10,000 slabs, $20M vaulted</th><th className="mono">500,000 slabs, $1B vaulted</th></tr>
            </thead>
            <tbody>
              <tr><td>Custody</td><td className="mono">$100,000</td><td className="mono">$5,000,000</td></tr>
              <tr><td>Trading</td><td className="mono">$300,000</td><td className="mono">$15,000,000</td></tr>
              <tr><td>Credit, a fifth borrowed</td><td className="mono">$120,000</td><td className="mono">$6,000,000</td></tr>
              <tr><td>Vaulting and redemption</td><td className="mono">$60,000</td><td className="mono">$3,000,000</td></tr>
              <tr><td><b>A year</b></td><td className="mono"><b>$580,000</b></td><td className="mono"><b>$29,000,000</b></td></tr>
            </tbody>
          </table>
        </div>
        <Prose>
          <p>
            Rather more than half of that does not require anybody to trade. The larger column is a fraction of one percent of the graded card market, which is the point of showing it. The model does not need Tivan to win the category. It needs the vault to fill.
          </p>
        </Prose>
      </Section>

      <Section id="order" title="5. The order it switches on">
        <KeyValue
          items={[
            ['First', 'Custody and the redemption fee, once a licensed vault partner holds the slabs. These need no trading volume at all, which is why they come first.'],
            ['Second', 'The taker fee, once the books carry enough resting depth that a fee does not drive the quotes away.'],
            ['Third', 'Credit, once there is a settled price history per card and an audit, because lending is the line that can lose somebody else’s money.'],
            ['Alongside', 'The grade attestation and the per-card price feed, sold to anyone else who needs them. No inventory, no custody risk, and it holds whether or not people trade on Tivan.'],
          ]}
        />
      </Section>

      <Section id="limits" title="6. What has to be true, and what Tivan will not do">
        <Prose>
          <ul>
            <li>Custody and insurance are real recurring costs, and they come out of the custody fee rather than sitting beside it, so the margin on that line is thinner than the headline rate.</li>
            <li>Lending against a collectible has a regulatory surface, and it is the line that needs a lawyer before it needs an engineer. It stays off until that is settled.</li>
            <li>A liquidation is only as safe as the depth under it, so borrowing limits have to be set from each book’s own depth rather than from one rate across every card.</li>
            <li>There is no token, no emission schedule and no yield that comes from anywhere other than the four lines above.</li>
            <li>There is no fractional ownership of a slab. Selling shares in one card is a security in most places, and it is what ended the last several companies that tried it.</li>
          </ul>
          <p>
            The current state of every contract and role is on the <A href="/contracts">contracts page</A>, and what is not yet decentralised is listed on the <A href="/security">security page</A>.
          </p>
        </Prose>
      </Section>
    </DocumentLayout>
  )
}
