# Tivan: sponsor bounty answers

Answers to what each bounty asks at submission, for Chainlink CRE, Mera (both bounties) and Envio. The Kuru answers are
in [kuru-bounties.md](kuru-bounties.md). Tivan runs on Monad testnet; contract addresses and measured runs are in
[DEPLOYMENTS.md](DEPLOYMENTS.md).

---

## Chainlink: Best workflow with CRE

**How Tivan uses CRE as an orchestration layer.** A token on Tivan stands for one graded card in the vault, so the most
important fact in the system is the grade. If a depositor could choose it, they could vault a PSA 7 and mint a PSA 10.
The CRE workflow `slab-attest` ([`cre/slab-attest`](../cre/slab-attest)) is the step that decides the grade:

1. **Trigger.** An HTTP trigger receives `{certId, holder, name, symbol}`. The grade and card are deliberately not in the
   payload.
2. **External API, with consensus.** Every node of the oracle network calls the grader registry over HTTP
   (`GetByCertNumber`, PSA's response shape) and parses the card spec and grade. The nodes must agree exactly
   (`consensusIdenticalAggregation`) before anything continues.
   - On testnet this is a PSA-shaped demo registry API hosted by our attestor, `/registry/psa/cert/{id}`, because we do
     not have a PSA API token.
   - With a token, the same code calls PSA's own API (`config.testnet-psa.json`, secret `PSA_TOKEN`).
3. **Blockchain read.** An EVM read on Monad checks `SlabVault.certs(certId)`, so a certificate the vault already knows is
   refused.
4. **Signed report, blockchain write.** The workflow builds a report carrying exactly `SlabVault.attest`'s arguments, the
   network signs it, and `writeReport` delivers it through the Keystone forwarder to `GradeOracle` on Monad
   ([`contracts/src/GradeOracle.sol`](../contracts/src/GradeOracle.sol)). GradeOracle accepts reports only from the
   forwarder and records each verified grade once.
5. **What follows from it.**
   - The attestor relay lists a certificate in the vault using the grade GradeOracle holds when there is one (source
     `chainlink-cre`).
   - The Envio indexer picks up every `GradeVerified` event.
   - The card page marks each certificate whose grade was verified through Chainlink CRE, with a link to the transaction.

So CRE connects an outside system (the grader registry) to Monad (the vault and GradeOracle), and its output decides
which tokens can exist.

**Simulation.** `cre workflow simulate ./slab-attest -T testnet-settings --trigger-index 0 --http-payload ... --broadcast`
runs the workflow against Monad testnet and writes through the simulation forwarder
(`0xB9F79d863261869B234c481D1f9A7af84AeAd192`) to GradeOracle (`0x63cbb0c3200ea053c3d487b31f4f3aa0323db3a0`). Our run
on 9 October 2026:
- the nodes verified cert 81234569 as spec 4, grade 10 through the registry API;
- the report was written in Monad testnet tx `0x33464a6267c4716a20f973b297c2949d8a86f15a974dbc676943b96401ed8dd3`,
  where GradeOracle emitted `GradeVerified`;
- the attestor then listed the cert in the vault with `verifiedBy: chainlink-cre` (tx
  `0x7c8de09c2817f7d0483859c64236d6c7904545de7af15bd73624bac3d8bfc18a`).

The full output is in [`cre/README.md`](../cre/README.md).

**Tests.** `bun test` runs the handler on the CRE SDK's test runtime: the fixtures path, PSA's own API with a bearer
token, the testnet demo registry API with no token writing to GradeOracle, and rejection of unknown certificates,
already-attested certificates and bad payloads.

---

## Monad: Best Mera-Powered UX

**Mera is the entire account layer.** There is no seed phrase, no extension, no email, and no custody backend.
- **Sign-up is one passkey ceremony.** `createPasskeyWithPrfOutput` returns the PRF output, which becomes a
  `createSecp256k1SigningSession`, turned into a viem account with `toViemAccount`.
- **The same passkey rebuilds the same account on any device** that has the passkey.

**Time to first transaction.** From the landing page to a confirmed Monad transaction takes **4 taps, 1 passkey ceremony,
about 6 seconds**, measured end to end (see DEPLOYMENTS.md):
1. Sign in.
2. Create an account with a passkey.
3. "Add $10,000 test dollars" in the welcome window.
4. Confirm.

Network fees are topped up from our testnet faucet before the first transaction, so a new account never stalls for MON.

**Session design.** One ceremony opens a 7-day session on that device ([`web/src/account.ts`](../web/src/account.ts),
`needsPasskey` in [`web/src/tx.tsx`](../web/src/tx.tsx)):
- **Signs with no prompt:** buying, selling, offers, listings and cancels up to $1,000 a trade, and adding cash. A
  $475.16 buy took 0 prompts and settled in 0.7 seconds.
- **Asks for the passkey again:** withdrawals (money leaving Tivan), redemptions (a card leaving the vault), key export,
  and any trade over $1,000. A $1,545 buy took 1 prompt. The review screen says why before the prompt appears.
- **Expiry.** The account page shows when the session ends and has an "End session" button. When it expires, even while
  the app is open, the stored key is deleted and the person sees "Your session ended", with one tap to start a new one.
  Their account, cash and cards are untouched.
- **Between visits.** The session's key is kept encrypted with a non-extractable AES key in IndexedDB, so a refresh
  needs no prompt.

**The stateless test.** We wiped all of the site's storage (localStorage, IndexedDB, everything), reloaded, and signed in
with the same passkey: same address, same balances. The private vault (below) also reopened and decrypted the same data
from chain. Nothing on our side is needed to rebuild an account.

**Stack composability.** Mera is combined with:
- gas sponsorship: testnet top-ups, and the relay that pays for private-vault writes;
- Kuru order books for every trade;
- a second, non-wallet PRF namespace (below).

---

## Monad: Mera, One Passkey, Many Keys

**A non-account use of Mera: the private vault.** Collectors keep a shipping address and private notes (what they paid
elsewhere, where a card came from) in a vault that only their passkey can open, on any of their devices
([`web/src/vault.ts`](../web/src/vault.ts)).

- **Its own namespace.** Unlocking asks the same passkey again with a different salt, `sha256("tivan.private-vault.v1")`,
  through `getPasskeyPrfOutput({ prfSalt })`. That output is unrelated to the account key, so the trading session cannot
  read the vault.
- **Three keys from one output, each for one job** (HKDF-SHA256 with distinct info strings):
  - **seal:** an AES-256-GCM key, non-extractable, that encrypts the vault. The locator is bound in as associated data,
    so a box copied to another slot will not open;
  - **locator:** 32 bytes that say where the sealed box lives;
  - **keeper:** a secp256k1 key that signs each write. It is not the trading account, so the box is not linked to the
    person's address on chain.
- **Nothing sensitive is stored, anywhere.**
  - The PRF output is zeroed after use, and the keys live only in the page while the vault is unlocked.
  - The only thing persisted is ciphertext, in [`SealedBox`](../contracts/src/SealedBox.sol) on Monad (untrusted
    storage).
  - SealedBox accepts a write only with the keeper's signature over the box and a nonce, so nobody can replace someone
    else's box.
  - Our relay submits the write and pays the gas, so the vault works even for an account with no MON. It can never
    forge a write.
- **The cross-device test.** The same passkey on a second device, or a fresh browser profile, derives the same locator
  and keys, reads the box from chain and decrypts it. We ran it with all site storage wiped: the vault reopened with the
  same name and notes.

---

## Envio: Best Use of Envio

**HyperIndex drives the data a trader sees** ([`indexer/`](../indexer)). It is deployed to Envio Cloud and uses
HyperSync on Monad testnet, with the public RPC as a fallback.

**Schema and handlers (beyond a single-event indexer).**
- **Factory pattern.** Every card and grade gets its own Kuru order book, created when its first certificate is
  verified. The indexer registers each new market at runtime from the vault's `SkuListed` and `MarketLinked` events
  (`contractRegister`), so new markets are indexed with no redeploy.
- **Entities.**
  - `Market`: per card and grade, with running aggregates for vaulted count, last price, volume and trade count.
  - `Trade`: every Kuru fill.
  - `MarketDay`: a daily OHLC candle with volume per market, aggregated in the handler as trades arrive.
  - `Cert`: the certificate lifecycle (attested, vaulted, redeemed).
  - `Order`: resting orders by owner.
  - `GradeCheck`: grades verified by the Chainlink CRE workflow, from GradeOracle's `GradeVerified` events.
- **Three contracts:** SlabVault, every Kuru market (dynamic), and GradeOracle.

**Features it powers in the app.**
- Price history and the trades table on every card page.
- The recent-trades feed across all cards: the landing-page tape and the sales feed.
- Last sale and the move since the previous sale on the markets page.
- 30-day traded volume and sale count, summed from the daily candles.
- Your trades: portfolio value over time, average cost, profit and loss, and the CSV export.
- Open orders by owner.
- The league standings.
- Each card's certificates, with the Chainlink CRE verification marked.

When the indexer is unavailable, history falls back to recent chain logs, and trading is unaffected.
