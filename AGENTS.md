# Working on Tivan

Guidance for any coding agent working on this repo. Read `MEMORY.md` for project facts and decisions, and `BRAND.md`
before any UI work. `CLAUDE.md` covers the graphify knowledge graph.

## Keep the notes current
- After any change that alters a fact, decision, gotcha or open item, update `MEMORY.md` in the same piece of work.
- Update this file when the layout, commands or rules change.
- Keep both files short. Replace stale lines; don't append a history.

## Layout
- `web/`: the app. React 19, Vite, TypeScript and viem.
  - `src/App.tsx`: the shell and routes. Routes use the hash: `#/`, `#/browse`, `#/card/:sku`, `#/collection`,
    `#/activity`, `#/sell`, `#/you`, `#/help`.
  - `src/kit.tsx`: shared page pieces (`PageHead`, `Stat`, `Delta`, `Spark`, `MarketTile`).
  - `src/controls.tsx`: buttons, selects, chips, segmented controls.
  - `src/desk.tsx`: tables, search, account menu, sales feed.
  - `src/tx.tsx` and `src/flows.ts`: every transaction goes through one review and status panel. On testnet the panel
    calls `ensureGas` (`src/attestor.ts`) before sending.
  - `src/Cash.tsx`: the cash modal (test dollars, deposit, withdraw, network fees) and the network panel.
  - `src/StatusBar.tsx`: the bottom bar (network, block, trade source, theme).
  - `src/logic/`: pure money, order, chart and portfolio maths, with tests in `web/tests/`.
  - `src/index.css`: the whole stylesheet, in order: tokens, base, shell, controls, data, pages, overlays.
- `contracts/`: Foundry, with `SlabVault` and `SlabToken`.
- `attestor/`: the server for cert checks, custody, the testnet MON faucet (`/drip`) and the maker. It deploys on Render.
- `indexer/`: Envio.
- `scripts/`: the maker bot and deploy helpers.

## Commands (run in `web/`)
- `npm run dev` starts the dev server. Set `VITE_ATTESTOR_URL=https://tivan-attestor.onrender.com` to reach the live
  attestor.
- `npx tsc -b` is the type check. `npm test` runs the logic tests with `node --test`.
- `npm run contrast` checks colour pairs in both themes. `npm run build` is the production build.
- Run the type check, tests, contrast check and build before calling any change done.

## Checking the UI
- Screenshot through headless Edge over the DevTools protocol (Page.captureScreenshot), not the in-app pane, which
  stalls when hidden.
- Set the viewport to the target width with Emulation.setDeviceMetricsOverride. For phones use 390x844 with mobile on,
  and check that `innerWidth` stays 390 (no sideways scroll).
- To test signed-in pages on testnet: put a throwaway key in `localStorage['slab.deviceKey']`, open `#/you`, and press
  "Continue with this device's test account". It is a test-mode account only; never use a real key.
- In Git Bash set `MSYS_NO_PATHCONV=1` before passing `#/route` arguments.
- Look at every changed screen in dark and light, at 390, 1280, 1440 and 1920 wide, before reporting.

## Rules
- Make the smallest change that solves the problem. No unrequested refactors or extra features. Reuse `kit.tsx`,
  `controls.tsx` and `desk.tsx` before writing new components.
- Money is bigint base units. Format only with `formatUsd`, `usdC` and `formatBps`. Never use floats for amounts sent
  on chain.
- Every surface has loading, empty and error states. Every control is keyboard reachable and shows visible focus.
- Truth comes first. Show only figures computed from real data. Name simulated things as simulated. Follow the owner
  decisions in `MEMORY.md`.
- Styling: use tokens from `:root` only, with no raw colours in components. Prices use the monospace figure styles.
  Both themes must pass `npm run contrast`.
- Layout: pages fill the width (a rail or a second column instead of empty space). Dialogs are centred modals, or
  bottom sheets on phones. The transaction panel is the one side drawer.
- Diagnose before fixing. Check chain state (balance, nonce) and the live server responses before changing code, and
  report what was actually found.
- When researching people (judges, mentors, partners), use only public professional records: role, firm,
  investments and public statements. No personal details.

## Git
- Never commit, push or install without the owner asking.
- When asked, use small Conventional Commits (`feat(web): ...`, `fix(attestor): ...`, `docs: ...`), lowercase with
  no period.
  - The author is the configured git user (Bunnyy).
  - Never add a Co-Authored-By or AI trailer.
- Stage only the files for each commit, and check `git status` for staged deletions first; `git commit` takes
  everything staged.
- After an owner-requested commit, push to `origin main`. Do not create extra branches.
- Attestor changes need a Render redeploy before they are live.
- Line endings are LF. Check `git diff --stat` for whole-file diffs before committing.
