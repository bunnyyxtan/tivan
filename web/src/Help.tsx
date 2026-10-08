import { useEffect, useState } from 'react'
import { setQuery, useQuery } from './route'
import { Breadcrumbs, openShortcuts } from './desk'
import { Button, Seg } from './controls'
import { explorerAddress, hasMarket, loadSkus, marketRules, type MarketRules } from './chain'
import { brand, net } from './config'
import { formatBps } from './logic/money.ts'
import { startTour } from './Tour'

type Topic = 'faq' | 'fees' | 'custody' | 'how'
const TOPICS: { value: Topic; label: string }[] = [{ value: 'faq', label: 'FAQ' }, { value: 'fees', label: 'Fees' }, { value: 'custody', label: 'Custody and verification' }, { value: 'how', label: 'How it works' }]
const test = net.name === 'testnet'

function useRules() {
  const [r, setR] = useState<MarketRules>()
  useEffect(() => {
    let live = true
    loadSkus().then((all) => {
      const s = all.find(hasMarket)
      return s ? marketRules(s.market) : undefined
    }).then((x) => live && setR(x), () => {})
    return () => void (live = false)
  }, [])
  return r
}

const FAQ: [string, string][] = [
  ['What is Tivan?', `${brand} is a market for graded trading cards. Each card at each grade is one market with its own token and its own order book, and the slabs behind it sit in a vault.`],
  ['Is this real money?', test ? 'No. This is a test network. The dollars are free test dollars with no value, prices come from an automated market maker, and custody is simulated.' : 'Cash is USDC on Monad. Check the Custody and verification page for what is and is not live.'],
  ['What is a market?', 'One card at one grade, for example a PSA 10 Charizard. Many slabs can sit in the vault behind it, and any one of them can back a token, so the token is interchangeable with the others at that grade.'],
  ['What are the ask, the best offer and the spread?', 'The ask is the lowest price anyone is selling at. The best offer is the highest price anyone is bidding. The spread is the gap between them.'],
  ['How do I get cash to trade?', test ? 'Open Cash from the header. You can add free test dollars, and get a little test MON for network fees. You can also send test dollars to your address from another wallet on this network.' : 'Open Cash from the header and send USDC on Monad to your address. Card and bank deposits are not offered.'],
  ['What are network fees?', 'Every action is a transaction on Monad, and the network charges a fee in MON for it. That is separate from the trading fee. The review screen shows an estimate before you confirm.'],
  ['Can I get the physical card?', test ? 'You can request it, and the request is recorded on the chain and retires your token. On this test network no physical cards are held, so nothing ships.' : 'You can request redemption. The vault partner arranges shipping with you.'],
  ['How do I keep my account safe?', 'Your account key comes from your passkey and stays on your device. In Account you can export the private key behind a fresh passkey check and store it somewhere safe. Anyone with that key controls your account.'],
  ['What if I lose my passkey?', 'If your passkey syncs through your password manager or your platform, it is on your other devices too. If it is gone everywhere, your private key is the only way back in. Export it ahead of time. We cannot recover it for you.'],
]

export function HelpPage() {
  const sp = useQuery()
  const topic = (TOPICS.find((t) => t.value === sp.get('s'))?.value ?? 'faq') as Topic
  const rules = useRules()
  return (
    <div className="c-reading help">
      <Breadcrumbs items={[['Discover', '#/'], ['Help']]} />
      <h1 className="page-h">Help</h1>
      <Seg label="Help topic" value={topic} onChange={(t) => setQuery({ s: t === 'faq' ? '' : t })} options={TOPICS} />
      <div className="help-body">
        {topic === 'faq' && (
          <>
            <div className="help-tools">
              <Button variant="secondary" size={40} onClick={startTour}>Take the tour</Button>
              <Button variant="tertiary" size={40} onClick={openShortcuts}>Keyboard shortcuts</Button>
            </div>
            {FAQ.map(([q, a]) => (
              <details key={q} className="faq">
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </>
        )}
        {topic === 'fees' && (
          <>
            <h2>Fees</h2>
            <p>Trading fees on {brand} are currently {rules ? formatBps(rules.takerBps, { digits: 2 }) : '…'} for buyers and sellers who take a price, and {rules ? formatBps(rules.makerBps, { digits: 2 }) : '…'} for those who post one. They are read from each market’s order book contract, so they can change, and the review screen always shows the figure for that order before you confirm.</p>
            <p>Network fees are separate. Every action is a transaction on Monad and is paid in MON. We show an estimate of about 0.02 MON per transaction; the real amount can differ. Network fees are not covered for you.</p>
            <p>Moving cash out to another wallet has no fee from {brand}; the network fee still applies.</p>
          </>
        )}
        {topic === 'custody' && (
          <>
            <h2>Custody and verification</h2>
            <p>A card enters the vault in steps: the certificate is requested, verified against a grader registry, the slab is received, and then a token is created for it. {test ? 'On this test network the registry is a demo registry and a demo custodian confirms receipt at once, so both steps are simulated and labelled as such where they happen.' : 'On mainnet a vault partner confirms the slab arrived before it can be tokenised.'}</p>
            <p>Redeeming a card records your request on the chain and retires the token. The vault releases the oldest copy of that grade first, so nobody can pick the best slab. {test ? 'On the test network no physical cards are held, so nothing ships.' : ''}</p>
            <p>The token contract and order book contract of every market link to the explorer from the market’s page, along with the certificates the indexer has recorded.</p>
          </>
        )}
        {topic === 'how' && (
          <>
            <h2>How it works</h2>
            <ol className="plain">
              <li>Each card at each grade is one market, with one token and one order book.</li>
              <li>You buy at the ask, make an offer, or sell at the best offer. Every order is a transaction on Monad.</li>
              <li>The slab behind the token stays in the vault. You can request it back, which retires the token.</li>
            </ol>
            <h3>On Monad and off it</h3>
            <ul className="plain">
              <li>On Monad: who owns each token, every order, every trade. Each can be checked on the <a className="u" href={net.chain.blockExplorers?.default.url} target="_blank" rel="noreferrer">explorer</a>{net.vault ? <>, starting from the <a className="u" href={explorerAddress(net.vault)} target="_blank" rel="noreferrer">vault contract</a></> : null}.</li>
              <li>Off Monad: the physical slab in the vault, and the check of its certificate against a grader registry.</li>
            </ul>
            <p>Built on Monad.</p>
          </>
        )}
      </div>
    </div>
  )
}

/** The footer: only links that resolve. "Built on Monad" is plain text until Monad's brand terms are confirmed. */
export function SiteFooter() {
  return (
    <footer className="site-foot">
      <div className="site-foot-in">
        <span>Built on Monad</span>
        <nav aria-label="Footer">
          <a href="#/help">Help center</a>
          <a href="#/help?s=fees">Fees</a>
          <a href="#/help?s=custody">Custody and verification</a>
          <a href="#/help?s=how">How it works</a>
          <button className="linkbtn quiet" onClick={openShortcuts}>Keyboard shortcuts</button>
          <a href="https://github.com/bunnyyxtan/tivan" target="_blank" rel="noreferrer">Source on GitHub</a>
        </nav>
      </div>
    </footer>
  )
}
