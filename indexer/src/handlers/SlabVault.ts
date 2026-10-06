import { indexer, type EvmOnEventContext } from "envio";

const ZERO = "0x0000000000000000000000000000000000000000";

// Every SKU gets its own Kuru OrderBook, deployed by SlabVault.listSku. Start indexing its trades.
// Where Kuru gates deployment (mainnet) SkuListed.market is zero and the book arrives later via MarketLinked.
indexer.contractRegister(
  { contract: "SlabVault", event: "SkuListed" },
  async ({ event, context }) => {
    if (event.params.market !== ZERO) context.chain.KuruMarket.add(event.params.market);
  },
);
indexer.contractRegister(
  { contract: "SlabVault", event: "MarketLinked" },
  async ({ event, context }) => {
    context.chain.KuruMarket.add(event.params.market);
  },
);

// NOTE: a SKU without a market yet is keyed by its bytes32 sku (never a valid address), re-keyed on MarketLinked,
// so Market.id stays "the Kuru OrderBook" for every row that can trade.
indexer.onEvent({ contract: "SlabVault", event: "SkuListed" }, async ({ event, context }) => {
  context.Market.set({
    id: event.params.market === ZERO ? event.params.sku : event.params.market,
    sku: event.params.sku,
    token: event.params.token,
    name: event.params.name,
    listedAt: event.block.timestamp,
    vaulted: 0,
    lastPriceCents: undefined,
    volumeCards: 0n,
    volumeCents: 0n,
    tradeCount: 0,
  });
});

indexer.onEvent({ contract: "SlabVault", event: "MarketLinked" }, async ({ event, context }) => {
  const pending = await context.Market.get(event.params.sku);
  if (!pending) return;
  context.Market.deleteUnsafe(pending.id);
  context.Market.set({ ...pending, id: event.params.market });
});

// SlabVault events carry the SKU, not the market; SkuListed is always emitted before the first
// Vaulted/Redeemed for that SKU, so we look the market up by sku.
async function marketBySku(context: EvmOnEventContext, sku: string) {
  const rows = await context.Market.getWhere({ sku: { _eq: sku } });
  return rows[0];
}

type CertEvent = {
  params: { certId: bigint; sku: string; holder: string };
  block: { timestamp: number };
};
function setCert(context: EvmOnEventContext, event: CertEvent, status: string) {
  context.Cert.set({
    id: event.params.certId.toString(),
    sku: event.params.sku,
    holder: event.params.holder,
    status,
    updatedAt: event.block.timestamp,
  });
}

indexer.onEvent({ contract: "SlabVault", event: "Attested" }, async ({ event, context }) => {
  setCert(context, event, "ATTESTED");
});

indexer.onEvent({ contract: "SlabVault", event: "Vaulted" }, async ({ event, context }) => {
  setCert(context, event, "VAULTED");
  const m = await marketBySku(context, event.params.sku);
  if (m) context.Market.set({ ...m, vaulted: m.vaulted + 1 });
});

indexer.onEvent({ contract: "SlabVault", event: "Redeemed" }, async ({ event, context }) => {
  setCert(context, event, "REDEEMED");
  const m = await marketBySku(context, event.params.sku);
  if (m) context.Market.set({ ...m, vaulted: m.vaulted - 1 });
});
