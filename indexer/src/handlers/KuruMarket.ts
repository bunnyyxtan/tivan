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

  // Daily candle per market, built as trades arrive (UTC days). Trades arrive in log order, so the first trade of the day
  // sets the open and each later one moves the close.
  const day = Math.floor(event.block.timestamp / 86_400);
  const id = `${market.id}_${day}`;
  const d = await context.MarketDay.get(id);
  context.MarketDay.set(
    d
      ? {
          ...d,
          highCents: priceCents > d.highCents ? priceCents : d.highCents,
          lowCents: priceCents < d.lowCents ? priceCents : d.lowCents,
          closeCents: priceCents,
          volumeCards: d.volumeCards + sizeCards,
          volumeCents: d.volumeCents + priceCents * sizeCards,
          trades: d.trades + 1,
        }
      : {
          id,
          market_id: market.id,
          day,
          openCents: priceCents,
          highCents: priceCents,
          lowCents: priceCents,
          closeCents: priceCents,
          volumeCards: sizeCards,
          volumeCents: priceCents * sizeCards,
          trades: 1,
        },
  );
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
