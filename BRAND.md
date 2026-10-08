# Tivan brand

Personality: precise, calm, serious, verifiable. A vault and an exchange, not a game store. Trust is the product.
Source of truth: `BUILD_BRIEF.md`, then this file. Where they differ, the brief wins and this file is corrected.

## Colour: two modes, one family
Dark is the reference (`docs/reference/palette.png`). Light is derived from it: the same violet hue family, the same
surface ladder, border logic, accent roles, states and gradient geometry; only lightness and opacity mirror.
No warm, brown or orange value remains. The Appearance setting is System, Light or Dark, applied before first paint by
the inline script in `web/index.html` (mirrored by `apply()` in `web/src/fx.tsx`), following the device live, with
`color-scheme` and `theme-color` set per mode. Tokens live in `web/src/index.css` `:root` and `:root[data-theme='light']`.

Extraction from the reference (1200x900 sample; the brief's anchors are used where text is anti-aliased):
- canvas #0E0C18, panel #1C1A24, raised card #292731, input #2A2930, header hairline #262431 (brief: #312F3A, kept).
- sidebar #181818 is pure grey; not followed, because surfaces keep violet chroma in both modes.
- primary button #583FA0, selected chip #825BEA, active navigation indicator #7D6EC5, headings white.
- secondary and tertiary text sampled #CECDD4 and #A7A5AD; tokens below are the contrast-checked values.
- positive and negative: not reliably sampled from anti-aliased text; the brief's values are used.
- backdrop haze: rises from the bottom edge, black at about 45% of the height, #0C0813 at 61%, #120D1C at 72%,
  #140E25 at 83%, peak #150F26 to #191128 at 89%, #140E25 at the edge; equal at left and right.
- chart: translucent violet fill under the line, transparent at the baseline. Featured card: soft violet outline.

Semantic tokens (dark / light): canvas #0E0C17 / #F6F5FA; surface-1 #151320 / #FFFFFF; surface-2 #1C1A25 / #EFEDF6;
surface-3 #25232F / #E6E3F0; border-subtle #2B2935 / #E4E1EE; border-strong #3C3948 / #C9C5DA; border-input #6B6880 / #857FA0;
text-primary #F4F3F8 / #14111F; text-secondary #B9B8C4 / #4F4B63; text-tertiary #8F8E9C / #6A6680 (light: never on surface-3);
action-solid #5C42A8 / #5236B8; action-hover #6A4EBC / #452CA0; action-pressed #4E3792 / #3B2590; action-label #FFFFFF;
chip-selected-fill #825BE8 / #5236B8 (label white, 4.55:1 dark); accent-text and focus #A992F2 / #5236B8;
accent-tint rgba(130,91,232,.18) / rgba(82,54,184,.10); nav-indicator #796CBE / #5236B8;
positive #3DD68C / #0F7A4F; negative #FF6B81 / #C0304A; warning #E8B454 / #8A5A00.
`web/scripts/check-contrast.mjs` measures every text, action and chip pair in both modes, including the worst haze point.

## Gradients: exactly three, static, from root variables
1. Page backdrop: the violet haze, fixed to the viewport behind everything (`body::before`).
2. Chart areas: line in accent-text, fill fading to transparent at the baseline.
3. Featured cards: the soft violet outline. Everywhere else, hairline borders.
Text never sits directly on a gradient. Artwork is never tinted or overlaid. No glow, blur, glass or drop shadow.

## Accent policy
Violet is for the primary action, selection, focus and links. Prices, values and axes stay in text-primary or
text-secondary. Gains and losses always carry a sign or a word as well as colour.

## Type
- Display: Newsreader, for the wordmark, page titles and the card title on the card page only. Real weights (variable,
  400 to 500 loaded), tabular figures by default, SIL OFL licence. Latin only, which is all the product needs.
- Interface: Geist for everything else, tabular figures on, weights 300 to 600 loaded, SIL OFL licence.
- Monospace for addresses, hashes, cert numbers and block numbers only, always with a copy control (`Copyable`).
- Roles, each defined once in `index.css` as `--f-*` and `--ls-*`: display 56, page title 34, section title 20,
  item title 15, body 16, label 13, numeric-large 30, numeric 16, caption 12.
- Sentence case everywhere. Uppercase only on table column headers.
- Fonts have metric-matched fallbacks (Arial and Georgia, size-adjusted), so the swap does not move the layout.

## Shape, space, controls
- Two radii: 6px (buttons, inputs, tags, art frames) and 12px (cards, panels, sheets). Chips are pills; buttons are not.
- Spacing 4, 8, 12, 16, 24, 32, 48, 72. Containers: market 1440, account 240 subnav + 760 column, reading 680.
- Buttons (`Button` in `controls.tsx`): primary (action-solid, one per view), secondary (outlined with border-input),
  tertiary (text), destructive. Sizes 32, 40, 48. Labels are verb-first and name the outcome. Pending keeps width and label.
- Shared controls in `controls.tsx`: option list, select, dual range, segmented control, chip, copy, scroll-edge cue.
  Targets are 32px on desktop and 44px on touch; touch screens get the native select.

## Imagery, icons, voice, motion
- The art is the most vivid thing on screen. Card art that is not a photograph of the slab is labelled as a reference image.
- One icon family, 24px grid, 1.6 stroke (`web/src/icons.tsx`). Wordmark is "Tivan" in the display face, no logo mark.
- Voice: calm and exact. No exclamation marks, no marketing language, no filler. Never "audited". Fees read "Currently 0%".
- Motion: 120 to 200 ms, transform and opacity only, explaining a state change. Reduced motion keeps every state cue.

## Never
Emoji, sparkle icons, status or live dots, gradients beyond the three, glow, neon, glass, blur, drop shadows, pure black
surfaces, a third radius step, default browser controls, truncated prices, grades or set names, invented
statistics or urgency, confetti, auto-rotating carousels, cursor-following effects, toasts for things shown in place.
