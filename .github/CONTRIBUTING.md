# Contributing

Thanks for looking at Tivan. I keep changes small, reviewable and honest about
what runs on Monad testnet, what exists on mainnet without a market, and what is
still a demo.

Live app, [https://tivan.store](https://tivan.store). Deployed addresses and
transaction hashes, [docs/DEPLOYMENTS.md](../docs/DEPLOYMENTS.md).

## Ground rules

- Everything that trades runs on Monad testnet (10143). Nothing in this repo
  moves real money, and no copy may suggest it does.
- The mainnet vault (143) holds DEMO tokens and has no order books. Kuru does
  not deploy mainnet markets. If you touch mainnet code paths, keep that true.
- The demo market maker in `scripts/` is mine. Its fills are never presented as
  user traction, in code comments, docs or UI copy.
- No keys, `.env` files, RPC credentials or generated output in a commit.

## Local setup

There is no root package manifest. Each workspace installs on its own.

```sh
git clone --recurse-submodules https://github.com/bunnyyxtan/tivan
cd tivan
cp .env.example .env     # DEPLOYER_KEY is a funded testnet key
```

Node 22, [Foundry](https://getfoundry.sh), and [Bun](https://bun.sh) for the CRE
workflow.

```sh
cd web && npm install && npm run dev        # http://localhost:5173
cd attestor && npm install && npm run dev   # http://localhost:8787
```

## Checks before opening a PR

Run the checks for the part you touched. A PR that changes two workspaces runs
both sets.

Web app.

```sh
cd web
npm run lint         # oxlint
npm run build        # tsc -b && vite build
npm test             # node --test
npm run contrast     # only if you changed colours or BRAND.md tokens
```

Contracts.

```sh
cd contracts
forge build
forge test --no-match-contract Mainnet --fork-url https://testnet-rpc.monad.xyz
forge test --match-contract Mainnet --fork-url https://rpc.monad.xyz
```

The testnet fork tests drive the whole flow against the real Kuru router,
attest, custody, list, fill, FIFO redeem and the role checks. The mainnet tests
cover the owner-gated deploy path and `linkMarket`. Both need network access, so
run them before pushing instead of hoping CI does it, since CI only builds the
CRE workflow today.

Attestor.

```sh
cd attestor && npm test
```

Agent Wallet plugin.

```sh
cd plugins/tivan && npm run type-check && npm test && npm run build
```

CRE workflow.

```sh
cd cre/slab-attest && bun install && bun test
```

The `Build CRE wasm` workflow compiles it to WASM on Linux, since Windows Smart
App Control blocks the unsigned `javy.exe` the compiler shells out to.

## Pull request guidance

- One concern per PR. Do not fold a refactor into a feature.
- Do not weaken the attestor's validation, its hourly caps, the passkey session
  rules, or the contract's role checks without saying why in the description.
- A change to `contracts/src`, `attestor/src`, or the sealed-vault path needs a
  test, or a reason in the description for why it has none.
- Grades come from the grader registry and never from the depositor. Any change
  near attestation keeps that direction of trust.
- Keep user-facing copy free of infrastructure jargon, and keep testnet
  behaviour labelled as testnet.
- UI work follows [BRAND.md](../BRAND.md).
- Update [docs/DEPLOYMENTS.md](../docs/DEPLOYMENTS.md) when an address or a
  verified run changes.

## Commit style

Conventional commits, imperative mood, subject under 72 characters, scoped by
directory (`web`, `contracts`, `attestor`, `indexer`, `cre`, `plugins`,
`scripts`, `brand`, `docs`).

```txt
feat(web): show the resting bid on the card page
fix(contracts): release the oldest slab on redeem
docs: record the CRE simulation run
```

The subject says what changed. The body says why, and is required for anything
touching the contracts, the attestor's signing path, passkey sessions or
redemption. Name the failure mode that motivated the change and what a reviewer
should check. Say so plainly when a commit only reformats or renames, so the
diff gets read at the right level of attention.

Do not use `chore:` for work that changes behaviour.

## Security reports

Do not open a public issue with exploit details. Follow
[SECURITY.md](./SECURITY.md).
