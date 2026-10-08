# Tivan project memory

Facts and decisions that are not obvious from the code. Update this file when they change; keep it short.
Last updated 2026-10-08.

## What Tivan is
A marketplace for graded trading cards on Monad. Each slab sits in a vault and is backed by one ERC-20 token
(`SlabToken`), and each card and grade has its own Kuru order book. Built for Monad Metropolis. Repo
bunnyyxtan/tivan (public), branch `main` only.

## Where it runs
- Web: https://bunnyyxtan.github.io/tivan/ (GitHub Pages) and https://tivan-six.vercel.app (Vercel, root `web`,
  auto-deploys from main). Passkeys are tied to the hostname, so pick one final domain before recording or submitting.
- Attestor and maker bot: https://tivan-attestor.onrender.com (Render free tier, woken by a keep-alive workflow).
- Indexer: Envio Cloud project `tivan`, deployed by `git push origin main:envio`. The endpoint URL is the repo
  variable `VITE_INDEXER_URL`; if the hash URL changes, update the variable and re-run Pages.
- Network: Monad testnet (10143) now. The owner wants the final submission on mainnet (143). Mainnet blockers:
  Kuru gates order-book creation on mainnet, and the mainnet signer needs MON.

## Owner decisions (binding)
- Design is "Ink and Brass" (see `BRAND.md`), chosen 2026-10-08 with full freedom: dark-first, ivory primary, one brass
  accent, Geist and Geist Mono, Newsreader for the wordmark and card names. It replaced the violet system.
- The app is an app, not a website: sidebar, top bar, status bar. No sign-in wall, no landing hero, no site footer.
- Key export only behind a fresh passkey check plus press-and-hold. Never say "seed phrase". No backup passkey: each
  passkey's PRF output gives a different address.
- Fees read from config and are worded "Currently 0%". "Built on Monad" is plain text only, with no logo.
- Card descriptions are optional and only ever owner-supplied with sources. Never generate them.
- 3D view is always labelled "Rendered view, not a photograph". Cert checks on testnet are labelled "Simulated check".
- Never write "audited". Redemption of the physical slab is not real; copy must not promise it.

## How it works (short)
- Accounts: the WebAuthn PRF output is the secp256k1 private key of a plain EOA (`web/src/account.ts`). On testnet a
  fallback key can live in localStorage (`slab.deviceKey`).
- Cash sits in Kuru's MarginAccount. Testnet cash is open-mint TestUSD. Users pay network fees in MON; the attestor
  `/drip` tops up testnet MON.
- Prices are in cents and sizes are whole cards. Money is bigint base units, formatted only through
  `web/src/logic/money.ts` (always en-US).
- Trades come from the Envio indexer, or from RPC logs (about the last 3,000 blocks) when it is unavailable.

## Gotchas
- Monad charges the gas limit, so each transaction costs about 0.02 MON.
- The free Quicknode tier caps getLogs at 5 blocks, and Ankr rejects large batched getLogs. The paid endpoint allows only
  the Vercel, Pages and localhost referrers, so server code must use the public RPCs.
- The Envio indexer is often slow or blocked from localhost in development. Empty sales figures locally are usually that.
- Windows: Git Bash rewrites arguments that start with `/` or `#/`; set `MSYS_NO_PATHCONV=1`. Python text-mode writes
  turn LF files into CRLF; write bytes.
- The in-app browser pane does not run requestAnimationFrame or fire dialog close events while hidden. Use headless Edge
  over the DevTools protocol for screenshots.

## Open items
- Phase 10 leftovers:
  - CSP check under `vite preview`;
  - a full screen-reader pass;
  - LCP and CLS measurement;
  - paging for long lists;
  - tests for the trade builders in `flows.ts`.
- The scanner (BarcodeDetector only) is untested on real PSA label photos.
- The maker retune must be redeployed on Render. The optional `TAKER_KEY` trader is untested.
- The logos in `brand/` predate Ink and Brass.
- Before submission: one final domain, videos, the submission form, repo access for the judges, and the mainnet switch.
