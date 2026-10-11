import { useEffect, useState } from 'react'
import { attestorUrl, brand, indexerUrl, net } from '../config'
import { gql, pub } from '../chain'
import { A, Address, Callout, DocumentLayout, KeyValue, Prose, Related, Section } from './Layout'
import { REPO } from './siteMap'

// Contracts, security and status: the pages a reader uses to check Tivan rather than take its word.
const test = net.name === 'testnet'
const ATTESTOR = '0xB9a34bD07273913F10012a74521A045e99C79098'
const MAKER = '0x9037a6733a9bd1641357ae5a12338378d3977911'
const ORACLE = '0x63cbb0c3200ea053c3d487b31f4f3aa0323db3a0'

export function ContractsPage() {
  const rows: [string, string | undefined, string][] = [
    ['SlabVault', net.vault, 'Records certs, mints and burns card tokens, deploys and links each order book, and runs redemption.'],
    [test ? 'TestUSD' : 'USDC', net.quote, test ? 'The test dollar every book is priced in. It has an open mint and no value.' : 'The dollar every book is priced in.'],
    ['Kuru router', net.kuruRouter, 'Deploys each order book and reports its verified rules and fees.'],
    ...(test ? ([['GradeOracle', ORACLE, 'Receives grades verified by the Chainlink CRE workflow and holds the record the attestor checks.']] as [string, string, string][]) : []),
    ...(net.sealedBox ? ([['SealedBox', net.sealedBox, 'Stores private-vault ciphertext. Only the keeper key that first wrote a box can replace it.']] as [string, string, string][]) : []),
  ]
  return (
    <DocumentLayout
      eyebrow="Trust"
      title="Contracts"
      standfirst={`Every contract ${brand} runs on ${net.chain.name}, chain ${net.chain.id}, with a link to read it on the explorer.`}
      crumbs={[[brand, '/'], ['Contracts']]}
      meta={[['Network', `${net.chain.name}, chain ${net.chain.id}`]]}
      after={<Related links={[['Whitepaper', '/whitepaper', 'Why the contracts are shaped the way they are.'], ['Security', '/security', 'The trust model and what is not yet decentralised.'], ['Source code', REPO, 'Contracts, tests and the deploy script.']]} />}
    >
      <Section id="core" title="Core contracts">
        <div className="pub-contracts">
          {rows.filter((r): r is [string, string, string] => !!r[1]).map(([name, addr, what]) => (
            <div key={name}>
              <b>{name}</b>
              <Address value={addr} />
              <small>{what}</small>
            </div>
          ))}
        </div>
      </Section>
      <Section id="per-card" title="Per card and grade">
        <Prose>
          <p>Each card and grade has its own token and order book, created by SlabVault on its first attest. Their addresses are read live from the vault, so the full list is on each card's page and from the indexer rather than kept here by hand.</p>
        </Prose>
      </Section>
      <Section id="roles" title="Roles">
        <KeyValue
          items={[
            ['Attestor', <Address key="a" value={ATTESTOR} />],
            ['Custodian', test ? 'The same key as the attestor on the test network' : 'The vault partner'],
            ...(test ? ([['Market maker', <Address key="m" value={MAKER} />]] as [string, React.ReactNode][]) : []),
          ]}
        />
        <Prose>
          <p>Roles are fixed when the vault is deployed and cannot be changed. Only the attestor can record a cert and only the custodian can confirm custody. Redemption and market linking are open to anyone, under the vault's own checks.</p>
        </Prose>
      </Section>
      <Section id="verify" title="Verify them yourself">
        <Prose>
          <p>The source is in the <A href={`${REPO}/tree/main/contracts`}>repository</A> with fork tests that run the full flow against the real Kuru router. GradeOracle's source is verified on <A href={`https://repo.sourcify.dev/10143/${ORACLE}`}>Sourcify</A>.</p>
        </Prose>
      </Section>
    </DocumentLayout>
  )
}

export function SecurityPage() {
  return (
    <DocumentLayout
      eyebrow="Trust"
      title="Security"
      standfirst={`How ${brand} protects accounts, the relay and the website, what is not yet decentralised, and how to report a problem.`}
      crumbs={[[brand, '/'], ['Security']]}
      after={<Related links={[['Risk disclosure', '/legal/risk', 'The ways using Tivan can go wrong.'], ['Contracts', '/contracts', 'Every deployed address.'], ['Status', '/status', 'Live checks of each service.']]} />}
    >
      <Callout tone="caution" title="Audit status">
        <p>The contracts have not been audited. Do not treat anything here as safe for real value.</p>
      </Callout>
      <Section id="accounts" title="Accounts and keys">
        <Prose>
          <ul>
            <li>Accounts are passkeys. The private key is derived from the passkey on your device and is never sent to a server.</li>
            <li>A session keeps the key for up to seven days, encrypted with a browser key that cannot be exported.</li>
            <li>Buys over $1,000 always ask for the passkey again.</li>
            <li>Exporting the key requires a fresh passkey check.</li>
          </ul>
        </Prose>
      </Section>
      <Section id="relay" title="The attestor relay">
        <Prose>
          <ul>
            <li>Every field it receives is validated, and request bodies are capped at 4 KB.</li>
            <li>Every sponsored write is capped per hour overall and per visitor, so one caller cannot spend the budget for everyone.</li>
            <li>Its signing key is held in the host's secret store and never logged. Its RPC key is separate from the website's.</li>
            <li>It can only relay a private-vault write that your keeper key signed, and the contract checks that signature.</li>
          </ul>
        </Prose>
      </Section>
      <Section id="website" title="The website">
        <Prose>
          <ul>
            <li>A strict Content-Security-Policy allows scripts only from {brand} itself and connections only to its own services.</li>
            <li>The site cannot be framed by another site, and camera, microphone, location and payment features are switched off.</li>
            <li>The website's RPC key accepts requests from tivan.store only.</li>
            <li>No source maps or server secrets are shipped in the bundle.</li>
          </ul>
        </Prose>
      </Section>
      <Section id="centralised" title="What is not yet decentralised">
        <Prose>
          <ul>
            <li>One key is attestor and custodian{test ? ' on the test network' : ''}. Whoever holds it decides which certs are recorded and when custody is confirmed.</li>
            <li>GradeOracle trusts its configured forwarder, and its owner can change that forwarder.</li>
            <li>Custody of physical slabs depends on the vault partner, outside the chain.</li>
          </ul>
        </Prose>
      </Section>
      <Section id="report" title="Report a problem">
        <Prose>
          <p>Open an issue on <A href={`${REPO}/issues`}>GitHub</A>. For anything that could put funds or accounts at risk, do not post the details. Open an issue asking for a private channel and the details can be shared there.</p>
        </Prose>
      </Section>
    </DocumentLayout>
  )
}

type Check = { name: string; what: string; run: () => Promise<string> }
type Result = { ok: boolean; ms: number; detail: string } | undefined
const timed = async (fn: () => Promise<string>): Promise<NonNullable<Result>> => {
  const t = performance.now()
  try {
    const detail = await fn()
    return { ok: true, ms: performance.now() - t, detail }
  } catch (e) {
    return { ok: false, ms: performance.now() - t, detail: e instanceof Error ? e.message.slice(0, 120) : 'No answer' }
  }
}

export function StatusPage() {
  const checks: Check[] = [
    { name: `${net.chain.name}`, what: 'The latest block from the RPC the app uses', run: async () => `Block ${(await pub.getBlockNumber()).toLocaleString('en-US')}` },
    ...(indexerUrl ? [{ name: 'Envio indexer', what: 'Markets, trades and price history', run: async () => `${(await gql<{ Market: unknown[] }>('{ Market { id } }')).Market.length} markets indexed` }] : []),
    {
      name: 'Attestor',
      what: 'Vault check-in, test gas and private-vault writes',
      run: async () => {
        const r = await fetch(`${attestorUrl}/health`, { signal: AbortSignal.timeout(20_000) })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return 'Answering'
      },
    },
  ]
  const [res, setRes] = useState<Result[]>([])
  const [at, setAt] = useState<Date>()
  const run = () => (setRes([]), Promise.all(checks.map((c) => timed(c.run))).then((r) => (setRes(r), setAt(new Date()))))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void run(), [])
  return (
    <DocumentLayout
      eyebrow="Trust"
      title="Status"
      standfirst="Live checks of each service, run from your browser when this page opens. There is no uptime history, because nothing here measures it."
      crumbs={[[brand, '/'], ['Status']]}
      meta={at ? [['Checked', at.toLocaleTimeString()]] : undefined}
      actions={<button className="ghost line md" onClick={run}>Check again</button>}
    >
      <Section id="services" title="Services">
        <div className="pub-status">
          {checks.map((c, i) => {
            const r = res[i]
            return (
              <div key={c.name} className={r ? (r.ok ? 'ok' : 'bad') : ''}>
                <i aria-hidden />
                <span>
                  <b>{c.name}</b>
                  <small>{c.what}</small>
                </span>
                <span className="pub-status-r">
                  <b>{r ? (r.ok ? 'Operational' : 'Not answering') : 'Checking'}</b>
                  <small>{r ? `${r.detail} · ${Math.round(r.ms)} ms` : ' '}</small>
                </span>
              </div>
            )
          })}
        </div>
      </Section>
      <Section id="notes" title="Notes">
        <Prose>
          <p>The attestor runs on a free host that sleeps when idle, so its first answer after a quiet spell can take up to a minute. If the indexer is down, the app reads markets straight from the chain and keeps working.</p>
        </Prose>
      </Section>
    </DocumentLayout>
  )
}
