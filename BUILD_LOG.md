# Build log

## Phase 0: architecture notes
- Wrote `ARCHITECTURE_NOTES.md` from the code: wallet model, deposit addresses, contract parameters, event
  source, network fees, on-ramp, card descriptions and the maker bot.
- Read only: `account.ts`, `chain.ts`, `config.ts`, `SlabVault.sol`, `Deploy.s.sol`, the attestor server
  and `scripts/maker.mjs`. No code changed.
- Omitted: nothing. Not verified: redemption in production, the Kuru AMM spread unit, Monad brand terms,
  contract audit status.
- Needs the owner: palette conflict with `BRAND.md` and the missing reference image, the uncommitted design
  pass, key export policy, fee plan, brand asset permission, card descriptions, inspector labelling and
  scanner registry. Full list at the end of `ARCHITECTURE_NOTES.md`.

## Phase 1: colour system, Appearance, typography, shared controls
- Replaced the palette with the brief's semantic tokens in both modes (`index.css`); no warm value remains. Read
  `docs/reference/palette.png` and recorded the extraction in `BRAND.md`, which is rewritten to match the brief.
- Appearance setting (System, Light, Dark) in Settings, applied before first paint from `index.html`, live with the device.
- Three gradients only: page haze, chart fill (`Chart` in `desk.tsx`), featured-card outline. Favicon recoloured.
- Type roles defined once (`--f-*`, `--ls-*`); metric-matched font fallbacks; only the weights in use are requested.
- Shared controls in `controls.tsx`: option list, select, dual range, segmented control, chip, button (pending state), copy.
- `web/scripts/check-contrast.mjs` measures every pair in both modes; all pass. The light haze was lifted to make tertiary text pass.
- Omitted: converting all 168 remaining ad-hoc `font-size` declarations to roles (Phase 10 sweep); `Chip` and `Button` are not yet used everywhere.
- Needs the owner: fonts still load from Google Fonts (a third-party request); self-hosting needs an npm install of fontsource packages.
  The logos in `brand/` and the README screenshots are still the old warm palette. A check mark character remains in `Vault.tsx`.

## Phase 2 - logic core and transaction panel
Pure money, order, chart and portfolio maths in web/src/logic with 26 node tests; one lifecycle state machine and a shared panel (tx.tsx). Live testnet lifecycle timed.

## Phase 3-4 - card page, chart, inspector
Card page with order book, spread bar, canvas price chart (keyboard, data table), lazy three.js inspector labelled "Rendered view, not a photograph". No back, corner or edge views: no such images exist.

## Phase 5 - trading flows and Activity
buy, offer, sell, list, cancel builders (flows.ts) feeding the panel; receipts; Activity merges the local log with indexer trades.

## Phase 6 - cash, account, key export
Cash sheet, deposit address with QR, network chip, Account page. Private-key export needs a fresh passkey check and press-and-hold. No backup passkey: PRF output is per credential, so a second passkey is a different address.

## Phase 7 - listing and vault
Sell flow with BarcodeDetector scan (no fallback library), server-side cert lookup, "Simulated check" wording. Old Vault/Collection pages removed; Redeem moved to Redeem.tsx, attestor calls to attestor.ts.

## Phase 8 - Discover, Browse, palette, Portfolio
Ctrl K palette, Discover, table/Compare, Portfolio at every width. Watchlist and alerts are stored on this device only.

## Phase 9 - onboarding
Welcome, Get started checklist, tour (<=5 steps), Help/FAQ, footer, demo notice. Copy says redemption is not live.

## Phase 10 - quality pass (partial)
Error boundary per route, offline bar, tables scroll under 900px. tsc, contrast, tests (26/26) and build pass. NOT done: CSP under vite preview, DOM a11y audit, LCP/CLS, paging for big lists, flows builder tests, 390/1920 visual review.
