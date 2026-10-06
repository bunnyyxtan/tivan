# Tivan indexer (Envio HyperIndex)

Indexes the SlabVault and every per-card Kuru market it deploys, so the web app can draw
**price history** and a **market list with volume** without scanning logs over RPC.

- `SlabVault.SkuListed` -> creates a `Market` row **and dynamically registers** the new Kuru
  OrderBook (`contractRegister`), so each card's market is indexed from the moment it exists.
  On Kuru mainnet market deployment is owner-gated, so `SkuListed.market` can be zero: the row is then keyed by the
  SKU (bytes32, a "pending" market) until `SlabVault.MarketLinked(sku, market)` re-keys it to the Kuru OrderBook and
  registers that book.
- `KuruMarket.Trade` (Kuru OrderBook fill, one log per maker order filled) -> `Trade` row,
  updates `Market.lastPriceCents / volumeCards / volumeCents / tradeCount`.
- `SlabVault.Attested / Vaulted / Redeemed` -> `Cert` status, `Market.vaulted` (cards in custody).
- `KuruMarket.OrderCreated` -> `Order` row (market, lowercased owner, price, size, side). The app uses it to find a
  user's order ids, then reads `s_orders` on chain to see which are still open (fills and cancels are not indexed).

Prices: Kuru emits `price` scaled 1e18 per whole card; we store integer **cents** (`price / 1e16`).
Sizes: SlabVault markets use `sizePrecision = 1`, so `filledSize` is whole cards.

## Networks (config switch)

| Network | Config | HyperSync | Contracts |
|---|---|---|---|
| Monad testnet 10143 | `config.yaml` | `https://10143.hypersync.xyz` | SlabVault `0x998a3116dc9AaDb98AF27B31BeC93441E1991a12`, start block 68468000 |
| Monad mainnet 143 | `config.mainnet.yaml` | `https://143.hypersync.xyz` | SlabVault `0x5ad7d5e06df36415c6f3fA48299Bf92ed921859a`, start block 110839500 |

Both chains are on Envio's HyperSync supported-network list. HyperSync requires `ENVIO_API_TOKEN`.
Without a token, `ENVIO_RPC_FOR=sync` makes the public Monad RPC the primary source.

## Run

```bash
cd indexer
npm install
cp .env.example .env        # add ENVIO_API_TOKEN (or ENVIO_RPC_FOR=sync)
npm run dev                 # envio dev: Docker Postgres + Hasura, GraphQL at http://localhost:8080/v1/graphql
# mainnet: npx envio dev --config config.mainnet.yaml
```

With a local Postgres and Hasura run by hand (what was verified on 2026-10-05; Docker Hub was rate-limited, so the image
came from `mirror.gcr.io`):

```bash
docker run -d --name slab-hasura --network host \
  -e HASURA_GRAPHQL_DATABASE_URL=postgres://postgres:<pw>@localhost:5432/envio_dev \
  -e HASURA_GRAPHQL_ADMIN_SECRET=testing -e HASURA_GRAPHQL_UNAUTHORIZED_ROLE=public \
  -e HASURA_GRAPHQL_CORS_DOMAIN='*' mirror.gcr.io/hasura/graphql-engine:v2.44.0
ENVIO_PG_HOST=localhost ENVIO_PG_PORT=5432 ENVIO_PG_USER=postgres ENVIO_PG_PASSWORD=<pw> \
ENVIO_PG_DATABASE=envio_dev ENVIO_HASURA=true HASURA_GRAPHQL_ENDPOINT=http://localhost:8080/v1/metadata \
HASURA_GRAPHQL_ADMIN_SECRET=testing ENVIO_RPC_FOR=sync NODE_USE_ENV_PROXY=1 npx envio start
```

The web app then uses `VITE_INDEXER_URL=http://localhost:8080/v1/graphql` (anonymous `public` role, read-only).

Without Docker at all, point `envio start` at any Postgres; Hasura is skipped (no GraphQL, data in Postgres only):

```bash
ENVIO_PG_HOST=localhost ENVIO_PG_PORT=5432 ENVIO_PG_USER=postgres ENVIO_PG_PASSWORD=... \
ENVIO_PG_DATABASE=envio_dev ENVIO_HASURA=false ENVIO_RPC_FOR=sync NODE_USE_ENV_PROXY=1 \
npx envio start
```

(`NODE_USE_ENV_PROXY=1` is only needed behind an HTTPS proxy,.)

## GraphQL (Hasura, `POST /v1/graphql`)

Addresses are EIP-55 checksummed (as emitted). `Market.id` is the Kuru market address.

**1. Market list** (home screen):

```graphql
query Markets {
  Market(order_by: { volumeCents: desc }) {
    id          # Kuru market address
    sku
    token
    name
    vaulted     # cards in custody
    lastPriceCents
    volumeCards
    volumeCents
    tradeCount
    listedAt
  }
}
```

**2. Price history for one card** (chart: x = `timestamp` unix seconds, y = `priceCents / 100`):

```graphql
query PriceHistory($market: String!, $since: Int = 0) {
  Trade(
    where: { market_id: { _eq: $market }, timestamp: { _gte: $since } }
    order_by: [{ timestamp: asc }, { id: asc }]
  ) {
    priceCents
    sizeCards
    takerBuy
    timestamp
    txHash
  }
}
```

**3. Recent trades across all cards** (ticker / activity feed):

```graphql
query RecentTrades($limit: Int = 20) {
  Trade(order_by: { timestamp: desc }, limit: $limit) {
    priceCents
    sizeCards
    timestamp
    txHash
    market { id name }
  }
}
```

**4. A user's order ids on one market** (app then checks `s_orders` on chain):

```graphql
query MyOrders($m: String!, $o: String!) {   # $o lowercased
  Order(where: { market: { _eq: $m }, owner: { _eq: $o } }) { orderId }
}
```

`BigInt` fields (`priceCents`, `volume*`, `sizeCards`) come back as JSON strings from Hasura -
`Number()` them (cents fit easily) or `BigInt()` if you prefer.

## Verified (2026-10-05, envio 3.12.1)

- `npx envio init template -t feature-factory -l typescript` scaffolded, then rewritten for Slab.
- `npx envio codegen` and `npx tsc --noEmit`: clean. `npx envio codegen --config config.mainnet.yaml` passes (the mainnet vault
  address is now in the config; it used to come from `ENVIO_SLAB_VAULT_MAINNET`).
- `npx envio start` against local Postgres 16 with `ENVIO_RPC_FOR=sync` indexed testnet from block
  68468000: 2 `Market` rows (PSA 10 and PSA 9 Base Set Charizard), 2 `Trade` rows ($420.00 tx
  `0x1b5068...b511` and $450.00), 4 `Cert` rows with correct VAULTED/REDEEMED status and
  `vaulted = 1` per market.
- Hasura GraphQL (2026-10-05, product-owner run): the market list, price history and order queries served the web app live while trades,
  bids and listings happened on testnet; new fills appeared in the chart within seconds.
- Not verified here: HyperSync (no `ENVIO_API_TOKEN` in this environment - endpoint answers 401
  without one) and `envio dev` (its Docker compose path).
