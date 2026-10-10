import { PageHead } from './kit'
import { brand, net } from './config'

// Privacy, terms and the not-found page. Plain pages in the Help layout, written in the owner's voice and dated, so a
// change to what the app does shows up here as a new date.
const UPDATED = '11 October 2026'
const REPO = 'https://github.com/bunnyyxtan/tivan'

export function PrivacyPage() {
  return (
    <div className="help legal">
      <PageHead title="Privacy" sub={`Last updated ${UPDATED}`} />
      <div className="help-body">
        <p>I built {brand} so that I hold as little about you as possible. There is no account database, no email address, no password and no profile on a server of mine.</p>
        <h2>What stays on your device</h2>
        <p>Your passkey lives in your device's passkey manager and never reaches me. The key that signs your trades is derived from it when you sign in and is kept in this browser, encrypted with a browser key that cannot be exported, for up to seven days.</p>
        <p>Your settings, watchlist, recent searches, price alerts, badges and activity log are saved in this browser only. Clearing the site's data in your browser removes all of them.</p>
        <h2>What is public on the chain</h2>
        <p>Your wallet address and every order, trade, deposit and transfer you make are transactions on {net.chain.name}. Anyone can read them, and nobody, including me, can delete them.</p>
        <p>The private vault is encrypted in your browser before it is saved, so only ciphertext is stored on the chain. Without your passkey nobody can read it, and that includes me.</p>
        <h2>Who sees your requests</h2>
        <p>Like any website, the services the app talks to see your IP address and what you ask them for. These are Vercel, which hosts this site, the Monad RPC providers that read and send transactions (Alchemy, Quicknode and Monad's public endpoint), Envio, which serves market history, and Google Fonts. My attestor on Render receives your wallet address when you ask for test gas, and the cert number when you vault a card. The attestor's own code logs errors only, while Vercel and Render keep standard access logs of their own.</p>
        <h2>No cookies and no tracking</h2>
        <p>{brand} sets no cookies and runs no analytics, ads or tracking scripts, which is why you never see a cookie banner here.</p>
        <h2>Questions</h2>
        <p>
          Ask me anything about this page by opening an issue on <a className="u" href={REPO} target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </div>
    </div>
  )
}

export function TermsPage() {
  const test = net.name === 'testnet'
  return (
    <div className="help legal">
      <PageHead title="Terms" sub={`Last updated ${UPDATED}`} />
      <div className="help-body">
        <p>By using {brand} you agree to these terms. They are short because what runs today is a demonstration, and I would rather you read all of it.</p>
        {test && (
          <>
            <h2>Nothing here has money value</h2>
            <p>{brand} runs on {net.chain.name}. The dollars you add are a test token, MON is test gas, and every card token stands for a slab whose custody is simulated. Requesting a card retires its token on the chain, but no physical card is shipped.</p>
          </>
        )}
        <h2>Not advice and not an offer</h2>
        <p>Prices on {brand} come from orders on public order books{test ? ' and, on the test network, from an automated market maker' : ''}. Nothing on this site is investment advice or an offer to sell anything.</p>
        <h2>Your keys are yours</h2>
        <p>Your account is your passkey. I cannot see it, reset it or recover it, so if you lose every device that holds it, the account and anything in it are lost too. You can export your private key from Account and keep it as a backup.</p>
        <h2>Fair use</h2>
        <p>The test gas faucet and the vault check-in are free and capped per hour, so that everyone gets a turn. Please do not script around the caps or try to break the service for other people.</p>
        <h2>Card names and pictures</h2>
        <p>Card names, artwork and grading marks belong to their owners. {brand} is not affiliated with or endorsed by PSA, The Pokémon Company, Wizards of the Coast, Konami, Topps or any player or league. Pictures are reference images of each card, not photographs of the slab in the vault.</p>
        <h2>The software</h2>
        <p>
          {brand} is open source under the <a className="u" href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">MIT license</a> and is provided as it is, without warranty. The contracts have not been audited. I may change, pause or reset the test deployment at any time.
        </p>
      </div>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="help legal">
      <PageHead title="Page not found" sub={`This address does not match a page on ${brand}. The link may be old or mistyped.`} />
      <p>
        <a className="btn md" href="/markets">Open Markets</a>
      </p>
    </div>
  )
}
