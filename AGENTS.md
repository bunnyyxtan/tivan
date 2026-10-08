# Working on Tivan

Guidance for any coding agent working on this repo. Read `MEMORY.md` for project facts and decisions, and `BRAND.md`
before any UI work. `CLAUDE.md` covers the graphify knowledge graph.

## Layout
- `web/`: the app. React 19, Vite, TypeScript and viem.
  - `src/App.tsx`: the shell and routes. Routes use the hash: `#/`, `#/browse`, `#/card/:sku`, `#/collection`,
    `#/activity`, `#/sell`, `#/you`, `#/help`.
  - `src/kit.tsx`: shared page pieces (`PageHead`, `Stat`, `Delta`, `Spark`, `MarketTile`).
  - `src/controls.tsx`: buttons, selects, chips, segmented controls.
  - `src/desk.tsx`: tables, search, account menu, sales feed.
  - `src/tx.tsx` and `src/flows.ts`: every transaction goes through one review and status panel.
  - `src/logic/`: pure money, order, chart and portfolio maths, with tests in `web/tests/`.
  - `src/index.css`: the whole stylesheet, in order: tokens, base, shell, controls, data, pages, overlays.
- `contracts/`: Foundry, with `SlabVault` and `SlabToken`.
- `attestor/`: the server for cert checks, custody, the gas drip and the maker.
- `indexer/`: Envio.
- `scripts/`: the maker bot and deploy helpers.

## Commands (run in `web/`)
- `npm run dev` starts the dev server. Set `VITE_ATTESTOR_URL=https://tivan-attestor.onrender.com` to reach the live
  attestor.
- `npx tsc -b` is the type check. `npm test` runs the logic tests with `node --test`.
- `npm run contrast` checks colour pairs in both themes. `npm run build` is the production build.
- Run the type check, tests, contrast check and build before calling any change done.

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
- Verify UI changes in a real browser at phone (390px) and desktop widths, in dark and light.

## Git
- Never commit, push or install without the owner asking.
- When asked, use small Conventional Commits (`feat(web): ...`, `fix(attestor): ...`, `docs: ...`), lowercase with
  no period.
  - The author is the configured git user (Bunnyy).
  - Never add a Co-Authored-By or AI trailer.
- After an owner-requested commit, push to `origin main`. Do not create extra branches.
- Line endings are LF. Check `git diff --stat` for whole-file diffs before committing.
