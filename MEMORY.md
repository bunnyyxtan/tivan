# Tivan project memory

Facts and decisions that are not obvious from the code. Update this file with every change that alters them; keep it short.
Last updated 2026-10-08.

## What Tivan is
A marketplace for graded trading cards on Monad. Each slab sits in a vault and is backed by one ERC-20 token
(`SlabToken`), and each card and grade has its own Kuru order book. Built for Monad Metropolis. Repo
bunnyyxtan/tivan (public), branch `main` only.

## Where it runs
- Web:
  - https://tivan.store, the custom domain in use by 2026-10-08;
  - https://tivan-six.vercel.app (Vercel, root `web`, auto-deploys from main);
  - https://bunnyyxtan.github.io/tivan/ (GitHub Pages).

  Passkeys are tied to the hostname, so pick one final domain before recording or submitting. The paid Quicknode
  endpoint accepts tivan.store (checked 2026-10-08).
- Attestor, faucet and maker bot: https://tivan-attestor.onrender.com (Render free tier, woken by a keep-alive
  workflow). Server changes go live only after Render redeploys from main; check, or use Manual Deploy.
- Indexer: Envio Cloud project `tivan`, deployed by `git push origin main:envio`. The endpoint URL is the repo
  variable `VITE_INDEXER_URL`; if the hash URL changes, update the variable and re-run Pages.
- Network: Monad testnet (10143) now. The owner wants the final submission on mainnet (143). Mainnet blockers:
  Kuru gates order-book creation on mainnet, and the mainnet signer needs MON.

## Owner decisions (binding)
- Design (see `BRAND.md`): the app layout chosen 2026-10-08 with full freedom (dark-first, Geist and Geist Mono,
  Newsreader for the wordmark and card names). Colours are "Forest": exactly the owner's six greens
  (#051F20, #0B2B26, #163832, #235347, #8EB69B, #DAF1DE), with no spring green. Mint buttons in dark mode, forest buttons in light.
- The app is an app, not a website: sidebar, top bar, status bar. No sign-in wall, no landing hero, no site footer.
  Pages use the full width; nothing sits in a narrow left column with empty space on the right.
- Cash opens as a centred modal (a bottom sheet on phones) with tabs: Test dollars, Deposit, Withdraw, Network fees.
  Not a side drawer.
- Key export only behind a fresh passkey check plus press-and-hold. Never say "seed phrase". No backup passkey: each
  passkey's PRF output gives a different address.
- Fees read from config and are worded "Currently 0%". "Built on Monad" is plain text only, with no logo.
- Card descriptions are optional and only ever owner-supplied with sources. Never generate them.
- 3D view is always labelled "Rendered view, not a photograph". Cert checks on testnet are labelled "Simulated check".
- Never write "audited". Redemption of the physical slab is not real; copy must not promise it.
- Network fees are not sponsored on mainnet. On testnet the app tops MON up from the faucet automatically.

## How it works (short)
- Accounts: the WebAuthn PRF output is the secp256k1 private key of a plain EOA (`web/src/account.ts`). On testnet a
  fallback key can live in localStorage (`slab.deviceKey`). Whoever signs a transaction pays its fee in MON, so a
  server wallet cannot pay for the user's transactions without smart accounts and a paymaster (not built).
- Testnet MON: before any transaction, `ensureGas` (`web/src/attestor.ts`, called from `tx.tsx`) asks the faucet when
  the balance is under 0.02 MON per step, then waits until the MON is visible. The faucet (`attestor/src/server.ts`)
  sends 0.2 MON to any balance under 0.1 MON, at most once per address every 10 minutes.
- Cash sits in Kuru's MarginAccount. Testnet cash is open-mint TestUSD (anyone can call `mint`).
- Prices are in cents and sizes are whole cards. Money is bigint base units, formatted only through
  `web/src/logic/money.ts` (always en-US).
- Trades come from the Envio indexer, or from RPC logs (about the last 3,000 blocks) when it is unavailable.

## Gotchas
- Monad charges the gas limit; budget about 0.02 MON per transaction. A real test-dollar mint costs about 0.008 MON.
- The free Quicknode tier caps getLogs at 5 blocks, and Ankr rejects large batched getLogs. The paid endpoint allows only
  listed referrers, so server code must use the public RPCs.
- The Envio indexer is often slow or blocked from localhost in development. Empty sales figures locally are usually that.
- CSS: a slab is a size container, so its wrapper needs a definite width wherever it is centred (`.stage .slab-wrap`,
  `.mtile-art .slab-wrap`). Without it the slab collapses to a sliver.
- Card page: the sticky image column (`.cx-media`) must stay inside `.cx` with only the buy box. The sections below
  (`.cx-rest`) sit outside `.cx`, or the sticky image slides over them while scrolling.
- Phone top bar: the search box needs `min-width: 0`, or the bar makes every page scroll sideways.
- Windows: Git Bash rewrites arguments that start with `/` or `#/`; set `MSYS_NO_PATHCONV=1`. Python text-mode writes
  turn LF files into CRLF; write bytes. Large bash heredocs fail; write scripts to files instead.
- The in-app browser pane does not run requestAnimationFrame or fire dialog close events while hidden. Use headless Edge
  over the DevTools protocol for screenshots (see `AGENTS.md`).
- `git commit` commits everything already staged, so check `git status` for staged deletions before committing a subset.

## Hackathon context (Metropolis)
- Build window 1 Sep to 13 Oct 2026, judging 14 to 27 Oct, winners announced 3 Nov. The prize pool is $250k, with
  $25k for the grand champion. Top teams are invited to a residency.
- Judges include Monad Foundation and Category Labs staff, and investors from Electric Capital, Paradigm, Castle Island,
  Galaxy, Dragonfly, Pantera, CoinFund, Archetype and 6th Man.
- Tivan's strongest link is Kuru: Electric Capital led Kuru's seed round and Paradigm led its Series A (both have judges
  here), and Kuru's CEO is a mentor. Envio, Quicknode, Dynamic (passkey wallets) and Mercuryo (on-ramp) staff are
  mentors or judges.
- Market context for the pitch:
  - On-chain spend on tokenized trading cards was about $324M in June 2026 (Blockworks Research, via KuCoin).
  - Courtyard (Polygon) and Collector Crypt (Solana) sell listings and packs; neither runs order books.
  - Expect the question of token prices drifting from the physical card, plus custody and the mainnet path.
- Research keeps to public professional records only (role, firm, investments, public statements), never personal details.

## Open items
- Phase 10 leftovers:
  - CSP check under `vite preview`;
  - a full screen-reader pass;
  - LCP and CLS measurement;
  - paging for long lists;
  - tests for the trade builders in `flows.ts`.
- Confirm Render redeployed the 0.1 MON faucet threshold (commit d8862e8).
- The scanner (BarcodeDetector only) is untested on real PSA label photos.
- The maker retune must be redeployed on Render. The optional `TAKER_KEY` trader is untested.
- The logos in `brand/` predate the Forest colours. The Network panel still opens as a side drawer.
- Before submission: one final domain, videos, the submission form, repo access for the judges, and the mainnet switch.
