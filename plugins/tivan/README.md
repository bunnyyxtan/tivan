# mm-plugin-tivan

A MetaMask Agent Wallet plugin that gives `mm` a new trading venue: **graded trading cards**.

Every PSA-graded slab in [Tivan](https://tivan.store)'s vault is tokenised one-for-one and
trades on its own [Kuru](https://kuru.io) order book on Monad. A card and a grade together make
a market — PSA 10 Charizard and PSA 9 Charizard are separate books at roughly 10x different
prices. This plugin lets an agent read those books and rest a bid on one, with every
transaction signed by the Agent Wallet.

## Commands

| Command | Capability | What it does |
|---|---|---|
| `mm tivan markets` | none | All 19 markets with live best bid and ask, straight from the Kuru books |
| `mm tivan buy <card> --price <dollars>` | `wallet-submit` | Rests a bid on that card's book |

```console
$ mm tivan markets
CHZ10     PSA 10 Base Set Charizard Holo        bid    $4,850.00  ask    $5,040.32
CHZ9      PSA 9  Base Set Charizard Holo        bid      $442.84  ask      $475.16
PIKA10    PSA 10 Base Set Pikachu Red Cheeks    bid    $1,300.00  ask    $1,550.37
...

$ mm tivan buy CHZ10 --price 4800
bid 1 x CHZ10 (PSA 10 Base Set Charizard Holo) at $4800.00 — 0x…
```

`--price` is dollars per card. `--size` is a whole number of cards (default 1); cards are
indivisible.

## Signing

The plugin holds no keys, tokens or seed material. `tivan:buy` obtains the wallet executor via
`ctx.walletExecutor(io, 'tivan:buy')` and submits the order through it, so Agent Wallet signing,
policy and MFA all apply unchanged. `tivan:markets` is pure chain reads over a public RPC and
declares no capability at all, so listing prices never touches the wallet.

Capabilities are declared per command in `package.json#mm` and approved at install time.

## Install

Plugins are beta, so enable them first:

```bash
mm config set experimentalPlugins true
mm config set experimentalAllowUnverifiedInstalls true
```

Then build and install from this directory:

```bash
npm install
npm run build
mm plugins install "file:$PWD" --accept-permissions
```

Install from the directory rather than a packed tarball — the CLI reads `package.json#mm` from
there to persist capability approvals. To iterate: `mm plugins uninstall mm-plugin-tivan`, rebuild,
reinstall.

## Agent instructions

[`skills/tivan/SKILL.md`](skills/tivan/SKILL.md) tells an agent when and how to reach for these
commands — including to list markets before bidding, to disambiguate the grade, and to confirm a
price with the user before submitting.

## Network

Monad testnet (chain 10143). Tivan's `SlabVault` is at `0x998a3116dc9AaDb98AF27B31BeC93441E1991a12`;
each market address is resolved from it at runtime via `skuInfo`, so the plugin never hardcodes a
book. Prices on testnet are seeded by an automated market maker, and cash and custody are simulated.

Cash must already sit in the Kuru MarginAccount — fund it in the Tivan app. This plugin places
orders; it does not move funds.

## Tests

```bash
npm test
```

Checks SKU derivation against the published on-chain hashes and the price/size unit maths
(prices are whole cents in a `uint32`, sizes are whole cards).

## Licence

MIT
