<p align="center">
  <img src="brand/logo-512.png" alt="Tivan" width="96">
</p>

# Tivan

A market for graded collectible cards on Monad. Each card and grade (for example, PSA 10 Base Set Charizard) is a
whole-unit token backed by a vaulted slab and trades on its own on-chain order book, priced in dollars and settled in
under a second. Holders can redeem the physical slab at any time.

**Live demo:** https://bunnyyxtan.github.io/tivan/ (Monad testnet; nothing uses real money, vault custody is simulated).

<p>
  <img src="docs/screenshots/markets-desktop-dark.jpg" alt="Markets, desktop, dark theme" width="49%">
  <img src="docs/screenshots/card-desktop-light.jpg" alt="Card page, desktop, light theme" width="49%">
</p>

Built for [Monad Metropolis](https://hackathon.monad.xyz). Running on Monad testnet; the mainnet vault is deployed with
demo tokens only. Addresses and transaction hashes are in [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md).

## Why

Tokenized card platforms list every slab as a unique NFT. A PSA 10 Charizard with cert 81234567 and one with cert
81234568 are separate listings even though collectors treat them as the same item, so there is no bid for "any PSA 10
Charizard", only asking prices and a wait. Tivan makes the grade the unit: all vaulted copies of one card and grade
share one fungible token and one order book, which gives a live bid, a live ask and a public price history.

## How it works

1. **Attest.** A depositor submits a grading cert. The attestor checks it against the grader's registry and takes the
   card and grade from the registry response, never from the user, then calls `SlabVault.attest`. The same check is
   implemented as a Chainlink CRE workflow in [`cre/`](cre).
2. **List.** The first attest of a new card and grade deploys its `SlabToken` (0 decimals) and a Kuru order book through
   `Router.deployProxy`. On Kuru mainnet that call is owner-gated, so the vault lists the token with no market and
   anyone can attach the book later with `linkMarket` (see [docs/mainnet-markets.md](docs/mainnet-markets.md)).
3. **Custody.** The custodian confirms receipt of the slab with `confirmCustody`, which mints one token to the depositor.
4. **Trade.** Kuru's limit order book handles limit orders, market orders and resting bids in USDC. Fees are 0%.
5. **Redeem.** `redeem(sku, shippingHash)` burns one token and releases the oldest vaulted copy of that card and
   grade, so holders cannot cherry-pick the best copy. Only a hash of the shipping details goes on-chain.

```mermaid
flowchart LR
  U[Web app<br/>passkey sign-in] -- cert --> A[Attestor / CRE workflow]
  A -- lookup --> R[(Grader registry)]
  A -- attest --> V[SlabVault]
  V -- deploy / link --> K[Kuru order book<br/>one per card + grade]
  C[Custodian] -- confirmCustody --> V
  U -- orders --> K
  U -- redeem --> V
  K -. trades, orders .-> I[Envio indexer]
  I -.-> U
```

## Monad integration

- **Why Monad.** One order book per card only works if a trade is cheap and final within about a second. Monad's fast finality and low fees make a real on-chain book per card practical, where it would be too slow or too costly elsewhere.
- **What runs on it.** `SlabVault` mints one whole-unit ERC-20 per (card, grade) and deploys each card's [Kuru](https://kuru.io) order book through the Kuru router. Buys, sells, offers, cancels and redemptions are all Monad transactions. Accounts are passkey wallets derived with [Mera](https://docs.monad.xyz/guides/mera).
- **Addresses.** Monad testnet (10143): vault `0x998a3116dc9AaDb98AF27B31BeC93441E1991a12`. Monad mainnet (143): vault `0x5ad7d5e06df36415c6f3fA48299Bf92ed921859a`. Transaction hashes for the vaulting, listing, trading and redeeming runs are in [docs/DEPLOYMENTS.md](docs/DEPLOYMENTS.md).
- **Verify it yourself.** Every receipt in the app links to the transaction on the Monad explorer.
- **Kuru.** How Tivan brings graded cards to Kuru as a new asset class, with issuance, redemption, custody, liquidity and the roadmap: [docs/kuru-bounties.md](docs/kuru-bounties.md).

## Architecture

```
browser (React, viem, passkey)  ──reads/writes──▶  Monad RPC ──▶ SlabVault ──▶ Kuru router ──▶ one order book per card
        │                                                 ▲
        ├── attestor (Node)  ── checks the grader cert, signs attest/custody, drips testnet gas ──┘
        └── Envio indexer (optional) ── trade history, League, open orders ◀── events from the vault and every book
```

## Attribution

Built on open-source work we did not write: [Kuru](https://kuru.io) contracts and router on Monad, [OpenZeppelin Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts) (MIT), [forge-std](https://github.com/foundry-rs/forge-std), [viem](https://viem.sh), [React](https://react.dev), [Vite](https://vitejs.dev), [Mera](https://docs.monad.xyz/guides/mera) for passkey accounts, [Envio HyperIndex](https://envio.dev) and the Chainlink CRE SDK. Card images in `web/public/cards` come from [Scryfall](https://scryfall.com) (Magic), the [Pokémon TCG API](https://pokemontcg.io) and [YGOPRODeck](https://ygoprodeck.com) (Yu-Gi-Oh!). They are the property of their respective owners, are shown for demonstration only, and Tivan is not affiliated with or endorsed by them. The Sports cards are public-domain vintage scans from [Wikimedia Commons](https://commons.wikimedia.org). Per-file sources and licences are in [web/public/cards/CREDITS.md](web/public/cards/CREDITS.md). A card without a photo would show a neutral "No photo yet" panel. Development started on 5 October 2026, inside the hackathon window. The history was consolidated into this repository on 6 October, so the commit dates here start that day and continue to the deadline.

### Use of AI coding tools

As the hackathon rules require, we disclose that AI coding tools were used to build Tivan. Claude Code (Anthropic)
helped with code across the web app, contracts, attestor, indexer and scripts, with the interface design, and with
research and documentation. The founder directed the product, made the design and architecture decisions, and reviewed,
ran and tested the work. Every claim in the app and docs is checked against the code and live chain data.

## Stack

| Layer | Choice |
|---|---|
| Chain | Monad (testnet 10143, mainnet 143) |
| Contracts | Solidity, Foundry, OpenZeppelin |
| Order books | Kuru CLOB, one market per card and grade |
| Grade verification | Chainlink CRE workflow, with a Node relay for the demo |
| Accounts | Mera passkeys (WebAuthn PRF), viem |
| Indexing | Envio HyperIndex, GraphQL |
| Web | Vite, React, TypeScript |

## Repository layout

```
contracts/   SlabVault, SlabToken, deploy script, Kuru fork tests
attestor/    Node relay: attest, custody, testnet gas drip, cert lookup
cre/         Chainlink CRE workflow and demo registry fixtures
indexer/     Envio indexer: SKUs, trades, orders
web/         React app (markets, trading, collection, vault, league)
scripts/     Testnet market maker
docs/        Deployments and mainnet market parameters
brand/       Logo assets
```

## Getting started

Requirements: Node 22, [Foundry](https://getfoundry.sh), and [Bun](https://bun.sh) for the CRE workflow.

```sh
git clone --recurse-submodules https://github.com/bunnyyxtan/tivan
cp .env.example .env        # DEPLOYER_KEY is a funded testnet key
```

**Contracts**

```sh
cd contracts
forge build
forge test --no-match-contract Mainnet --fork-url https://testnet-rpc.monad.xyz
forge test --match-contract Mainnet --fork-url https://rpc.monad.xyz
```

The testnet fork tests run the full flow against the real Kuru router: attest, custody, list at $420, fill with a market
buy, redeem in FIFO order, and role checks. The mainnet tests cover the owner-gated deploy path and `linkMarket`.

**Attestor**

```sh
cd attestor && npm install && npm run dev   # http://localhost:8787
```

**Web app**

```sh
cd web && npm install && npm run dev        # http://localhost:5173
```

| Variable | Default | Purpose |
|---|---|---|
| `VITE_NETWORK` | `testnet` | `testnet` or `mainnet` |
| `VITE_ATTESTOR_URL` | `http://localhost:8787` | Attestor relay |
| `VITE_INDEXER_URL` | unset | Envio GraphQL endpoint; without it the app reads the chain directly |
| `VITE_RPC_URL` | unset | Dedicated RPC endpoint tried first (restrict it to your domain); the public RPCs stay as extra capacity |
| `VITE_RPC_LIMIT` | `40` | Requests per second that endpoint tolerates |
| `VITE_RPC_LOGS` | `false` | Set `true` only if that endpoint allows 100-block `eth_getLogs` ranges (free Quicknode caps it at 5) |
| `VITE_BASE` | `/` | Public base path, set by the Pages workflow |

**Indexer** (needs a free Envio token, see [indexer/README.md](indexer/README.md))

```sh
cd indexer && npm install && npm run dev
```

**Market maker** (quotes a bid and ask on cards that have none, using the maker account's own funds)

```sh
cd scripts && npm install
MAKER_KEY=0x... node maker.mjs          # keeps quoting, refills every 20 s
MAKER_KEY=0x... node maker.mjs --once   # one pass
```

## Deployments

| Network | SlabVault |
|---|---|
| Monad testnet | `0x998a3116dc9AaDb98AF27B31BeC93441E1991a12` |
| Monad mainnet | `0x5ad7d5e06df36415c6f3fA48299Bf92ed921859a` (demo tokens, markets pending Kuru) |

## Limitations

- The team key is both attestor and custodian on testnet. In production the custodian confirms only after physically
  receiving and inspecting the slab, and the demo's open custody endpoint would not exist.
- No physical cards are held. The mainnet tokens are labelled DEMO and the redeem flow records a request only.
- The demo market maker is ours and quotes every card. When a card sells out it vaults a fresh copy using a synthetic testnet cert (numbers from 90,000,000, accepted only on testnet). Its trades are not user traction.
- Certs are checked against demo fixtures shaped like PSA responses. The PSA API code path exists and is tested with
  mocks, but has not run against the live API.
- Chainlink CRE does not write to Monad in production yet, so the attestor relay performs the same registry check. The
  workflow compiles and passes its tests.
- Tokens are whole cards. Within a grade, copies differ in centering and eye appeal; FIFO redemption and a curated list
  of liquid cards limit that, they do not remove it.
- Mainnet order books do not exist until Kuru deploys them. Trading is verified on testnet only.
- The contracts have not been audited.

## Notes

Parts of the code, tests and documentation were written with AI coding assistants. The design, review and testing are
the author's.

## License

[MIT](LICENSE)
