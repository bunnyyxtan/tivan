# Tivan and Kuru: bounty submission answers

Answers to the questions asked at submission for the two Kuru bounties at Monad Metropolis:
**Bring New Assets and Markets to Kuru** and **Build the Next Consumer Trading App on Kuru**. Tivan is built and run by
one founder, who will keep building it after the hackathon.

What is live today, stated plainly: Tivan runs on Monad testnet with 19 card-and-grade markets, each with its own Kuru
order book. Custody and the certificate check are simulated on testnet, and testnet prices come from our own market-maker
bot. The mainnet vault is deployed, and four demo markets wait for Kuru to create their books (Kuru's router only lets its
own team create markets on mainnet).

---

## 1. The new asset class

**Graded trading cards, as one fungible token per card and grade.**

A graded card ("slab") is a card sealed in a case by a grading company, with a grade from 1 to 10 and a certificate
number. Today every slab trades as a one-off item: on eBay, at card shows, or as a 1-of-1 NFT on tokenized platforms.
There is no bid for "any PSA 10 Base Set Charizard", only asking prices and a wait.

Tivan makes **the card and grade the unit**. Every vaulted copy of the same card at the same grade backs one token of the
same ERC-20 (0 decimals, so a token is one whole slab), and each card-and-grade gets its own Kuru spot order book against
USDC. That turns a market of unique listings into a market with a live bid, a live ask, a spread and a public price
history, which no one offers on chain today. Courtyard (Polygon) and Collector Crypt (Solana) tokenize cards as 1-of-1
NFTs and sell them as listings and packs; neither runs an order book.

Markets Tivan brings to Kuru:
- every grader's slabs (PSA first, then BGS, CGC and SGC), across Pokémon, sports, Magic, Yu-Gi-Oh! and other TCGs;
- one market per card and grade, created automatically the first time a card of that grade passes its certificate check;
- later, index markets (for example a basket of PSA 10 Base Set holos), built from the same per-grade tokens.

## 2. Target users

Graded cards are a global hobby, so Tivan is built for collectors everywhere, in this order:

1. **Collector-traders** who already buy and flip graded cards on eBay and at shows. They pay high selling fees, wait days
   for a buyer, and price from old sales. Tivan gives them an instant sale at the best offer and a buy at the ask, in about
   a second.
2. **Collectors outside the United States.** Most graded cards and most vaults are in the US. Buying from India, Southeast
   Asia, Europe or Latin America means shipping, customs and risk. With the slab vaulted, ownership moves on chain and the
   card only ships once, when someone redeems it.
3. **People who want exposure to a card as an asset**, such as a PSA 10 of a famous card, with real price discovery and
   the ability to sell at any time, instead of buying a single copy and hoping for a buyer later.
4. **Dealers, card shops and breakers**, who hold inventory. For them Tivan is a sales channel and a place to quote both
   sides: vault stock once, then sell it to buyers worldwide without shipping each card.
5. **Crypto-native traders on Monad** looking for markets that do not move with crypto prices.

## 3. Evidence of demand

- **Grading is at record highs.** About 26.6 million cards were graded by the major graders in 2025, the most in a single
  year since GemRate began tracking. PSA alone graded about 19.26 million, up 26% on the year, and held 72% of the market.
  Pokémon was the largest single category, with more than 16.1 million cards graded. ([CLLCT][cllct], [SI][si])
- **People already buy and sell vaulted cards without touching them.** PSA Vault, PSA's insured storage tied to eBay, moves
  ownership instantly when a vaulted card is bought and kept in the vault. ([eBay][ebayvault])
- **Tokenized cards are a large and growing on-chain market.** On-chain spending on tokenized trading cards was about
  $324M in June 2026, more than five times the year before ([KuCoin, citing Blockworks Research][kucoin]). Collector Crypt
  reports over $1B in cumulative volume and more than 130,000 tokenized graded cards in custody ([Solana][solana],
  [The Block][theblock]).
- **Physically backed tokens with vault custody are an accepted model.** Courtyard holds its cards with Brink's and burns
  the token when a card is redeemed. ([Nasdaq][brinks])
- **What is missing is an exchange.** These platforms sell listings and packs. None gives a card a live bid and ask, which
  is what Tivan adds, on Kuru.

Our own usage, honestly: by 9 October 2026 the testnet had recorded 31 trades from 17 addresses. Most of them are the
founder's own test accounts and our market-maker bot, so we do not present them as demand. Real-user numbers from the
testing round before the deadline will be added here, counted from the indexer with our own addresses excluded.

## 4. Issuance, redemption and settlement

All of this is in the contracts and running on testnet ([`contracts/src/SlabVault.sol`](../contracts/src/SlabVault.sol)).

1. **Certificate check.** A depositor submits a grading certificate number. The card, set and grade are taken from the
   grader's registry, never from the user. This check runs as a Chainlink CRE workflow ([`cre/`](../cre)), where each
   node of the oracle network looks the certificate up independently and the network signs one report. A certificate can
   only ever be used once.
2. **Listing.** The first verified copy of a new card and grade creates its token and its Kuru order book through
   `Router.deployProxy` (whole cards, prices in cents, 0% maker and taker fees). On mainnet, where Kuru creates markets
   itself, our vault attaches a Kuru market with `linkMarket` only after Kuru's router confirms the market trades this
   card's token against our USDC.
3. **Custody, then mint.** The vault partner confirms the slab has arrived, and only then is one token minted to the
   depositor. Tokens can never outnumber slabs in the vault, and anyone can check this on chain.
4. **Trading and settlement.** All trading is on Kuru: limit orders, market orders, offers and cancels, settled on Monad
   in under a second (0.7 to 0.8 seconds measured from send to confirmation). Cash sits in each user's Kuru margin
   account.
5. **Redemption.** Burning one token releases the oldest vaulted copy of that card and grade (first in, first out), so
   nobody can pick the best-looking copy. Only a hash of the shipping details goes on chain.

Accounts are passkeys (fingerprint, face or screen lock) through Mera, so a collector needs no wallet app and no seed
phrase.

## 5. Bringing the asset on chain legally and operationally

**Custody (chosen partner, agreement not yet signed).** Tivan will start with **PSA Vault**, run by Collectors, PSA's
parent company. PSA grades about 72% of all cards, so most slabs people want to trade are PSA slabs, and PSA Vault
already handles insured storage and instant ownership transfer for eBay. Collector Crypt already uses PSA Vault, PWCC
(now Fanatics Collect) and ALT's Delaware facility as vault partners, so these partners already work with tokenized cards.
Our alternates are **ALT** and **Fanatics Collect**. The custody contract would cover:
- insurance at replacement value;
- confirming each slab on intake;
- a monthly reconciliation of vault contents against on-chain supply, published;
- shipping on redemption.

**Legal structure (to be confirmed by counsel before mainnet launch).**
- Each token is a claim on one slab of a stated card and grade held in custody, redeemable for the physical card. It works
  like a warehouse receipt.
- Tivan promises no yield, revenue share or profit, and the token gives no rights beyond the card itself. This is the
  model used by vaulted-collectible platforms such as Courtyard and PSA Vault.
- We will get a legal opinion on how the token is classified in the US and the EU before mainnet.
- Launch only where the opinion allows, and block sanctioned and restricted regions.

**Compliance and operations.**
- Identity checks (KYC) at redemption and for large cash movements, through the vault partner or a KYC provider.
- Sanctions screening of addresses.
- Sales tax and customs handled at redemption, when the card actually ships.
- Terms of service that state custody, insurance, fees and redemption times.
- A public proof-of-reserves page: tokens issued per card and grade against slabs vaulted, with certificate numbers. The
  certificate data is already on chain and in our indexer.
- The live PSA registry lookup replaces the testnet demo registry once we have PSA API access.

**Known risk, addressed up front.** A token's price can drift from the physical card's market price. Redemption is the
anchor: if a token trades well below the card's value, buying it and redeeming the card closes the gap, and if it trades
above, vaulting a card and selling the token does. Next to the order book we will show recent marketplace sales of
the same card and grade, so traders can see any gap.

## 6. Liquidity and initial market formation

1. **Start narrow and deep.** Launch with about 20 of the most traded card-and-grade pairs (modern and vintage Pokémon,
   top sports rookies), chosen from grading population and sales data. One deep market beats ten empty ones.
2. **Seed inventory.** Vault a first set of slabs for each launch market, bought by Tivan or deposited by launch partners,
   so every market opens with cards for sale.
3. **Two-sided quotes from day one.** Our market-maker bot already quotes both sides on testnet, around the card's
   reference price. On mainnet it runs with a published address and its own capital, and never trades against itself.
4. **Kuru's built-in pool.** Each Kuru market can carry its own automated liquidity pool (our markets are created with a
   0.3% pool spread). Funding these pools gives every card an always-on price straight from Kuru. We will test this on
   testnet and ask Kuru's team about the best setup.
5. **Dealers as market makers.** Card shops and dealers already hold inventory and know prices. A dealer programme gives
   them listing tools, zero maker fees and a share of trading activity they bring.
6. **Kuru liquidity introductions.** Both Kuru bounties offer liquidity introductions and market-listing support, which we
   will take up for the launch markets.
7. **Arbitrage brings traders.** When the token price differs from eBay prices, traders can profit from closing the gap,
   which keeps prices honest and adds volume.

## 7. Onboarding and keeping traders

**Getting people in.**
- **No crypto knowledge needed.** Sign in with a passkey, add cash, buy a card. No wallet, no seed phrase, and testnet gas
  is topped up automatically. A card-on-ramp partner (for example Mercuryo, which already sells MON on Monad by card and
  Apple Pay) is next.
- **Meet collectors where they are.** Card YouTube, TikTok and Discord communities, card shows, and card shops. The pitch
  is simple: sell a slab in one second, or buy at a real price instead of an asking price.
- **Sellers first.** "Vault your slab, list it free" brings inventory, and inventory brings buyers.
- **Dealers and breakers** bring their own customers through the dealer programme.
- **Referrals** that reward both sides once a friend makes a first trade.

**Keeping them.**
- **Instant exits.** Being able to sell at any time is the main reason to keep cards on Tivan rather than in a drawer.
- **A portfolio that matters.** The value of every card at the live best offer, with average cost and profit or loss.
- **Price alerts and a watchlist** for the cards people are chasing.
- **Achievements and league standings** (first card, first sale, sub-second trade, and more), already in the app.
- **New markets weekly**, timed with set releases and big sports moments, so there is always something new to trade.
- **Low fees.** Trading fees are 0% today. Any future fee will stay well below the cost of selling a card on a
  marketplace.

## 8. Roadmap beyond the hackathon

The founder will keep building Tivan full-time after Metropolis.

| When | What |
|---|---|
| October to November 2026 | Mainnet markets with Kuru for the four demo cards; a real-user testing round; PSA registry API access; the CRE workflow on a live oracle network |
| By end of 2026 | Custody agreement signed (PSA Vault first); legal opinion; first 20 real markets with seed inventory; redemption with identity checks; card on-ramp |
| Early 2027 | Dealer programme; installable mobile app; more graders (BGS, CGC, SGC); funded Kuru pools; a trading API for market makers |
| Mid 2027 | Index markets (baskets of cards); regional launches with local payment methods; a public proof-of-reserves dashboard |

What we would like from Kuru:
- listing the mainnet markets (the parameters are tested on a mainnet fork and written down in
  [docs/mainnet-markets.md](mainnet-markets.md));
- liquidity introductions;
- advice on market making for high-value, low-volume assets.

## 9. How the integration works (for the "strength of integration" criterion)

- Market creation: `SlabVault._list` calls Kuru's `Router.deployProxy` per card and grade on testnet; on mainnet,
  `linkMarket` checks `Router.verifiedMarket` before attaching a Kuru market.
- Trading: every buy, sell, offer, listing and cancel in the web app is a Kuru order-book transaction
  ([`web/src/flows.ts`](../web/src/flows.ts), [`web/src/chain.ts`](../web/src/chain.ts)).
- Cash: deposits and withdrawals go to the user's Kuru margin account, read from `Router.marginAccountAddress()`.
- Prices and the order book: read from each market's `getL2Book` on chain.
- History: the Envio indexer reads every Kuru market's trade events ([`indexer/`](../indexer)).
- Liquidity: our maker bot quotes through the same Kuru books ([`scripts/maker.mjs`](../scripts/maker.mjs)).
- Tests: Foundry fork tests run the full flow against the real Kuru router on testnet and mainnet
  ([`contracts/test`](../contracts/test)).

[cllct]: https://www.cllct.com/sports-collectibles/sports-cards/major-authenticators-graded-more-than-26-million-cards-in-2025
[si]: https://www.si.com/collectibles/over-26-million-cards-graded-in-2025-how-the-market-exploded
[ebayvault]: https://www.ebay.com/help/selling/trading-cards-listing-tools/using-the-ebay-vault?id=5342
[kucoin]: https://www.kucoin.com/news/flash/tokenized-pok-mon-cards-drive-324m-in-june-2026-on-chain-spending-surpassing-2025-by-over-fivefold
[solana]: https://solana.com/news/tokenized-cards-and-physical-collectibles
[theblock]: https://www.theblock.co/post/369869/collector-crypt-drives-150-million-in-randomized-pokemon-card-trades-as-cards-token-soars
[brinks]: https://www.nasdaq.com/press-release/courtyard-physically-backed-nft-platform-partners-with-brinks-to-safeguard-assets
