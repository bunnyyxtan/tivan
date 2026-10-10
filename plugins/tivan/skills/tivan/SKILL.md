---
name: tivan
description: Trade graded trading cards (PSA-graded Pokémon, Magic, Yu-Gi-Oh! and vintage sports slabs) on Tivan's Kuru order books on Monad. Use when the user wants to see what a graded card is trading at, compare bids and asks across cards or grades, or place a bid on a specific card. Trigger on card names ("Charizard", "Black Lotus", "Honus Wagner"), on grade talk ("PSA 10", "PSA 9"), and on asks like "what's the spread on", "bid $X on", "what cards are cheap right now".
---

# Tivan: graded-card trading on Monad

Every graded slab in Tivan's vault is tokenised one-for-one and trades on **its own Kuru
order book**. A card and a grade together make a market: PSA 10 Charizard and PSA 9
Charizard are two separate books with separate prices.

This plugin gives the Agent Wallet three commands. Every transaction is signed by the Agent
Wallet — the plugin holds no keys and never bypasses signing, policy or MFA.

## Commands

### `mm tivan orders <address>`

Shows what an address still has resting on Tivan's books. Orders come from Tivan's Envio
indexer and each one is re-checked on the book with `s_orders`, so a filled or cancelled order
never shows. No wallet capability, no signing, no cost.

Use it after a bid to confirm the order rested, and whenever the user asks what they have open.
The address is required: ask for it rather than guessing.

### `mm tivan markets`

Lists all 19 markets with their best bid and ask, read live from the Kuru books on Monad
testnet. No wallet capability, no signing, no cost. Add `--json` for machine-readable output.

Run this **first** whenever the user asks about prices, and before any bid — card ids come
from here, and the ask tells you what a realistic bid looks like.

```
CHZ10     PSA 10 Base Set Charizard Holo        bid    $4,850.00  ask    $5,040.32
CHZ9      PSA 9  Base Set Charizard Holo        bid      $442.84  ask      $475.16
PIKA10    PSA 10 Base Set Pikachu Red Cheeks    bid    $1,300.00  ask    $1,550.37
```

A `—` means that side of the book is empty: no one is selling (ask) or no one is bidding (bid).

### `mm tivan buy <card> --price <dollars> [--size <n>]`

Rests a **bid** on that card's book at a limit price in dollars per card. Requires the
`wallet-submit` capability, so the Agent Wallet prompts for approval and applies its policy
and MFA as normal.

```
mm tivan buy CHZ10 --price 4800
mm tivan buy WAGNER3 --price 640000 --size 1
```

- `<card>` is a card id from `mm tivan markets` (case-insensitive, e.g. `chz10`).
- `--price` is **dollars per card**, not cents. $4,800 is `--price 4800`.
- `--size` is a whole number of cards and defaults to 1. Cards are indivisible; there are no
  fractional sizes.

This places a resting limit order, not a market buy. A bid below the ask sits on the book
until someone sells into it. Orders are post-only: a bid at or above the current ask is refused
before anything is signed, so always bid below the ask. To buy straight away, tell the user to
take the ask in the Tivan app.

## How to use this well

1. **Always run `mm tivan markets` before bidding.** Prices move, and the card id has to be exact.
2. **Quote the user a price before you submit.** Say which card, what price, and what the current
   ask is, then let them confirm. A bid is real money and the Agent Wallet will ask them to sign.
3. **Respect the grade.** "Charizard" is ambiguous — `CHZ10` and `CHZ9` differ by about 10x in
   price. Ask which grade if the user hasn't said.
4. **Sanity-check the price.** A bid at or above the ask is refused, so suggest one just under it.
   A bid far below it will simply never fill, which is fine if they intended a lowball, but say so.
5. **Cash must already be in the Kuru MarginAccount.** The plugin places orders; it does not move
   funds. If a bid reverts for want of margin, tell the user to fund their account in the Tivan
   app at https://tivan.store rather than trying to work around it.

## Scope and limits

- Monad **testnet** (chain 10143). Prices are seeded by an automated market maker; cash and
  custody are simulated.
- The plugin can **bid**. It cannot sell, cancel, or place market orders — do those in the app.
- The card catalog is the 19 seeded markets. A card that is not in `mm tivan markets` has no book.
