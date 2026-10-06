# Tivan web app

Mobile-first React + TypeScript + viem app: passkey sign-in (Mera), per-card Kuru order books, vaulting, redemption.

```bash
npm install
npm run dev                          # testnet (default)
VITE_NETWORK=mainnet npm run build   # mainnet: vault 0x5ad7…859a, USDC quote, 4 DEMO SKUs (markets pending Kuru listing)
```

| Env | Default | |
|---|---|---|
| `VITE_NETWORK` | `testnet` | picks the entry in `src/config.ts` (chain, vault, quote token, Kuru router) |
| `VITE_ATTESTOR_URL` | `http://localhost:8787` | attestor service (`../attestor`, `npm start`) for `/attest`, `/custody`, `/drip`, `/cert/:id` |
| `VITE_INDEXER_URL` | unset | Envio GraphQL (`../indexer`), e.g. `http://localhost:8080/v1/graphql`. Market list, price charts and open-order ids come from it; unset, the app reads the RPC directly |

Screens: Markets (every SKU the vault listed, with best ask/bid and vaulted count, filtered by Pokémon / Sports / Magic), Card (price history, live L2 book, Buy now, Sell, Place bid, your open orders with Cancel), Vault a card (PSA cert → registry lookup pre-fills card and grade → attest → custody), Redeem (burn 1 → oldest cert id, shipping hash), Account (balances incl. funds in open orders, withdraw, "Get test dollars" on testnet, which also tops up MON when low).

- **Sign-in**: `createPasskeyWithPrfOutput` / `getPasskeyPrfOutput` → the 32-byte PRF output is the secp256k1 key → `createSecp256k1SigningSession` → `toViemAccount`. Only the credential id is stored. Browsers without WebAuthn PRF get a fallback key in localStorage (marked `NOTE:` in `src/account.ts`, testnet only).
- **Pending markets**: Kuru mainnet gates `deployProxy`, so a SKU can have `market == 0x0` until Kuru deploys its book and someone calls `SlabVault.linkMarket`. The market is always re-read from `skuInfo` (so a link shows up without an event scan); while it is zero the card shows "Market opening soon — awaiting Kuru listing" with no trading controls, and no book, chart or order read is sent. Token names starting with "DEMO" get a DEMO chip, and mainnet shows a demo-listings notice.
- **Reads**: the public Monad RPC caps `eth_getLogs` at 100 blocks and ~15 req/s, so `src/chain.ts` rate-limits every call. With `VITE_INDEXER_URL` the SKU list, trades and order ids come from Envio. Without it the app scans only the last ~3k blocks (about 20 minutes) for `SkuListed`, `Trade` and `OrderCreated`, and older SKUs come from `seedSkus` in config. Whether an order is still open is always read from the chain (`s_orders`).
- Kuru encoding (verified on testnet): order prices in cents (`pricePrecision` 100), sizes in whole cards, `bestBidAsk` scaled 1e18, `getL2Book` = block number then (price, size) words for bids, zero, asks.

