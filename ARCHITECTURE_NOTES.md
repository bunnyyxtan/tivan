# Architecture notes (Phase 0)
Read-only findings from the code. Each line cites its source.
- **Wallet model.** A passkey with WebAuthn PRF; the PRF output is used directly as a secp256k1 private key for a
  plain EOA, re-derived at each sign-in and held in memory (`web/src/account.ts` `fromPrf`). Only passkey
  metadata is stored (`slab.passkey`). Testnet fallback: a random key in localStorage (`slab.deviceKey`).
  There is no seed phrase and no smart account, so the key is user-controlled and technically exportable.
- **Deposit addresses.** The EOA address itself, derived on the device. No server creates or holds user keys
  (`account.ts`; the attestor only attests, records custody and drips gas, `attestor/src/server.ts`).
- **Contracts.** `SlabVault` lists a card and grade (SKU), deploys a `SlabToken` and a Kuru order book through
  the Kuru router, and queues vaulted certs FIFO for redemption (`contracts/src/SlabVault.sol`). Market
  parameters set in `contracts/script/Deploy.s.sol`: size precision 1 (whole cards), price precision 100
  (cents), tick size 1, min size 1, max size 1000, taker and maker fee 0 bps, AMM spread 30 (unit not verified).
  The app's order ABI has no expiry field: limit orders rest until filled or cancelled (`web/src/chain.ts`
  `bookAbi`). Cash lives in Kuru's MarginAccount. Platform fee: none in code; README states fees are 0%.
- **Event source.** An Envio indexer (`indexer/`, `VITE_INDEXER_URL`) for markets, trades and last sale.
  Without it the app reads RPC logs, which only reach back about 3,000 blocks (`chain.ts` `tradeHistory`).
- **Network fees.** Not sponsored. Users pay MON. On testnet the attestor `/drip` tops up gas with an hourly
  cap (`attestor/src/server.ts`); Monad charges the gas limit, so each transaction costs about 0.02 MON.
- **On-ramp.** No card or bank provider exists. Testnet cash is open-mint TestUSD (`net.mintableQuote`,
  `web/src/config.ts`); mainnet would be a plain USDC transfer to the user's address.
- **Card descriptions.** None exist. Only `catalog` titles, sets, categories and reference images
  (`config.ts`); every image is labelled `reference`, none is a photograph of a slab.
- **Maker bot.** `scripts/maker.mjs` (Render) keeps one ask and one bid per live card from fixed reference
  prices. The uncommitted retune gives each card its own drift and spread, leaves three markets with no
  offers, and adds an optional `TAKER_KEY` trader (untested on chain). Existing orders are never touched.
- **Verified vs not.** Not verified from code: what a production redemption ships, the Kuru AMM spread unit,
  the Monad brand-asset terms, and any audit status of the contracts.

## Questions for the owner
1. The brief's violet palette, light mode and three gradients conflict with `BRAND.md` (one warm dark theme,
   no gradients, no light mode). Which wins? The reference image was not attached, and `DESIGN_STANDARD.md`,
   `docs/UI.md` and `docs/UX.md` do not exist in the repo.
2. Commit or discard the uncommitted design pass (11 modified files plus `web/src/controls.tsx`) first?
3. Key export: allow "Export private key" behind passkey re-authentication, or only offer "Add a backup
   passkey" and "Move funds to your own wallet"?
4. Confirm 0% fees on every market, and whether a platform fee is planned.
5. Permission and source for a "Built on Monad" mark, and who writes card descriptions and where they live.
6. The 3D inspector would render reference art, labelled "Rendered view, not a photograph". Acceptable?
7. Do PSA slab barcodes encode the cert number, and is a real registry API available for the scanner?

## Owner decisions (recorded after Phase 0)
1. Palette: BUILD_BRIEF.md supersedes BRAND.md; its warm-only and no-gradient rules are retired and BRAND.md is rewritten in Phase 1. Reference image: `docs/reference/palette.png` (if unreadable, use the brief's sampled anchors and say so). No DESIGN_STANDARD.md.
2. The earlier design pass is a checkpoint on a local branch, not pushed; `main` is untouched.
3. Key export: build "Export private key" behind a fresh passkey check, press-and-hold reveal, no logging, memory cleared after. Never say seed phrase. No backup-passkey flow unless a second passkey provably recovers the same address (report in Phase 6).
4. Fees: 0% is the current value, read from config; copy says "Currently 0%", never "free forever". Network fees are separate, in MON.
5. Plain-text "Built on Monad" only, no logo or partnership wording. Card descriptions: optional section, shown only when the owner supplies text with sources; never generated.
6. Inspector: 3D view only with the permanent label "Rendered view, not a photograph". Test scanning on real label photos. Cert lookups go through a server route; without registry access keep the simulated check labelled "Simulated check".
7. Phase 3 first confirms the AMM spread unit before any spread figure. Never write "audited". Phase 9: check whether "Ask for the slab" redemption is real and fix onboarding copy if not.
8. Not in the repo yet: `docs/reference/palette.png`, `docs/UI.md`, `docs/UX.md` and `BUILD_BRIEF.md`; add them before Phase 1.
