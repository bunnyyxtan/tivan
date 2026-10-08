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
