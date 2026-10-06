import { indexer } from "envio";

// Kuru emits price scaled 1e18 (quote units per whole card); pricePrecision is 100, so /1e16 = cents.
const CENTS = 10n ** 16n;

indexer.onEvent({ contract: "KuruMarket", event: "Trade" }, async ({ event, context }) => {
  const market = await context.Market.get(event.srcAddress);
  if (!market) return; // only markets SlabVault registered; contractRegister guarantees this
  const priceCents = event.params.price / CENTS;
  // NOTE: sizePrecision is 1 for every SlabVault market, so filledSize == whole cards.
  const sizeCards = event.params.filledSize;

  context.Trade.set({
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    market_id: market.id,
    priceCents,
    sizeCards,
    takerBuy: event.params.isBuy,
    maker: event.params.makerAddress,
    taker: event.params.takerAddress,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });

  context.Market.set({
    ...market,
    lastPriceCents: priceCents,
    volumeCards: market.volumeCards + sizeCards,
    volumeCents: market.volumeCents + priceCents * sizeCards,
    tradeCount: market.tradeCount + 1,
  });
});

indexer.onEvent({ contract: "KuruMarket", event: "OrderCreated" }, async ({ event, context }) => {
  context.Order.set({
    id: `${event.srcAddress}_${event.params.orderId}`,
    market: event.srcAddress,
    owner: event.params.owner.toLowerCase(),
    orderId: event.params.orderId,
    priceCents: event.params.price,
    size: event.params.size,
    isBuy: event.params.isBuy,
    createdAt: event.block.timestamp,
  });
});
