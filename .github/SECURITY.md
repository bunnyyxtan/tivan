# Security

Tivan runs on Monad testnet (10143), where nothing uses real money and vault
custody is simulated. A vault is also deployed on Monad mainnet (143) holding
DEMO tokens with no order books attached. The contracts have not had an
independent audit, so treat every deployment as unaudited code.

Live app, [https://tivan.store](https://tivan.store). The current trust model is
written out at [tivan.store/security](https://tivan.store/security).

## Reporting

Report privately through GitHub private vulnerability reporting for this
repository, at
[Security advisories](https://github.com/bunnyyxtan/tivan/security/advisories/new).
If private reporting is unavailable, open an issue asking for a private channel
and share the details there. Nothing that could put accounts or funds at risk
goes in a public issue.

Never include real private keys, seed phrases, API tokens or live secrets in a
report. A testnet address and a transaction hash are enough to reproduce almost
anything here.

I am one person, so expect an acknowledgement within a few days rather than the
same hour.

## In scope

- Solidity contracts in `contracts/src`, `SlabVault`, `SlabToken` and
  `GradeOracle`, including the role checks and FIFO redemption
- The attestor relay in `attestor/`, its validation, its hourly sponsorship
  caps, its signing path and its cert lookup
- Passkey account derivation, session storage and the export flow in `web/`
- The sealed private vault, its key derivation and the relayed write path
- The Envio indexer in `indexer/` where wrong data would mislead a trader
- The Chainlink CRE workflow in `cre/slab-attest`
- The MetaMask Agent Wallet plugin in `plugins/tivan`
- Website headers, CSP and anything in the deployed bundle that leaks a secret

## Out of scope

- Kuru's contracts and router, which Tivan calls but does not own
- Monad RPC outages, rate limits and faucet problems
- Third-party wallet and browser bugs
- Anything that requires a leaked private key or a compromised device
- Claims about the value of testnet assets
- Denial of service without a practical security impact
- Spam, phishing and social engineering reports
- The known centralisation documented at
  [tivan.store/security](https://tivan.store/security), where one key is both
  attestor and custodian on testnet

## Bounty status

There is no funded bug bounty. Credit in the repository is what I can offer.
