# Tivan brand

Personality: precise, calm, serious. An auction house or a private vault, not a game store.
Confident through restraint. The interface is a quiet, warm, dark gallery; colour belongs to the artwork.

## One theme
Dark only. No theme setting, no light mode, no colour derived from a card. Tokens live in
`web/src/index.css` `:root`; components use roles, never raw colours.

## Colour
- Canvas `--canvas #12100e`.
- Surfaces, four warm steps: `--surface-1 #1a1714`, `-2 #221e1a`, `-3 #2b2621`.
- Borders: hairline ivory, `--line` (9%) and `--line-strong` (17%).
- Ink, ivory in three levels: `--ink #f2ece4`, `--ink-2 #b8ada2`, `--ink-3 #9a8f85`.
  The quietest level is at least 4.7:1 on every surface.
- Accent: one ember, `--accent #e07f55` (hover `#ea9068`, press `#cf7248`), label `--on-accent`.
  Fill only the primary action; selection is a surface step with an accent outline; focus is an
  accent ring. Never a wash, never decoration. Label on accent measures 5.6 to 7.9:1.
- Status: `--up`, `--down`, `--warn`, muted, always beside a sign or a word.
- `--scrim` dims the page behind sheets. `--slab-strip` and `--slab-label` depict the real PSA label.

## Type
- Display: Newsreader, for the wordmark, page titles and item titles only.
- Sans: Geist, for everything else, with tabular figures on by default.
- Why: Newsreader has an optical-size axis and a calm catalogue voice, where Fraunces reads playful and
  Instrument Serif has one weight. Geist has `tnum` (measured: equal widths for 1111111 and 0000000),
  `$ € £ − · —` in-font, a variable weight axis and an OFL licence, where Plex is wider and
  Instrument Sans is static.
- Roles: `--t-display 34`, `--t-title 24`, `--t-body 16`, `--t-small 14`, `--t-cap 12`.

## Shape and space
- Two radius steps: `--r1 6px` (buttons, inputs, tags, art frames) and `--r2 12px` (cards, panels, sheets).
  Nested radii are concentric: inner = outer minus padding.
- Pills only for compact chips and the switch track. No shadows.
- Spacing scale `--s1..--s7` = 4, 8, 12, 16, 24, 32, 48.

## Icons, imagery, voice, motion
- Icons: one family, 24px grid, 1.6 stroke (`web/src/icons.tsx`).
- Imagery: the art is the most vivid thing on screen. Never tint, recolour or overlay it.
- Wordmark: "Tivan" in Newsreader. No logo mark. The favicon is an ivory serif T on the canvas.
- Voice: calm and exact. No exclamation marks, no marketing language, no filler.
- Motion: 120 to 200 ms. Press feedback, sheet and panel transitions, numbers that really changed.
  Nothing ambient. The reduce-motion setting removes all of it.

## Never
- A gradient, glow, blur or glass panel. The one exception is a scrim directly behind text on imagery,
  and only where measured contrast needs it. None exists today.
- A theme switch, a stored theme, or a colour taken from a card.
- Accent as a background wash, or status colour without a sign or word.
- Pure white or pure black, a third radius step, a pill button, a drop shadow.
- An invented logo mark, an emoji icon, a status or live dot, invented stats or fake urgency.
