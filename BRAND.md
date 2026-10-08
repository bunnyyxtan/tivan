# Tivan brand: Forest

Personality: precise, calm, serious, verifiable. A vault and an exchange, not a game store. Trust is the product.
The layout system was rebuilt on 2026-10-08, when the owner asked for a redesign from scratch with full freedom,
dark-first, in a classic style with no AI look. Tokens live in `web/src/index.css` (`:root`, then
`:root[data-theme='light']`), and `web/scripts/check-contrast.mjs` measures every text, action and chip pair in both modes.

## Colour: Forest (owner palette, exact)
- Six colours, used as given: #051F20, #0B2B26, #163832, #235347, #8EB69B, #DAF1DE. Values between two of them are
  blends of neighbours, only where a step is missing (for example surface-2 #10322C and text-secondary #B4D4BD).
- Dark (default):
  - canvas #051F20, panels #0B2B26, raised and selected areas #163832;
  - borders #163832 and #235347;
  - text #DAF1DE, then #B4D4BD, then #8EB69B.
  - Primary buttons are #DAF1DE with #051F20 text. Brand marks, links and focus use #8EB69B.
- Light:
  - canvas #EEF8F0, panels white, raised and selected areas #DAF1DE, strong borders #8EB69B;
  - text #051F20, then #163832, then #235347.
  - Primary buttons are #163832 with #DAF1DE text. Brand marks, links and focus use #235347.
- The wordmark tile uses the palette's own gradient (#235347 to #8EB69B dark, #0B2B26 to #235347 light). Nowhere else.
- Price up uses the brand green with ▲ and a faint tint; price down uses coral (#F08A7E dark, #B3364A light) with ▼.
- Allowed gradients: the slab stage (a soft #235347 to #0B2B26 light), the chart fill, the skeleton sheen and the
  wordmark tile. Shadows only on overlays and staged slabs.

## Type
- Geist for the interface and headings: page titles 28, section titles 17, body 15, labels 13.
- Geist Mono for figures (prices, changes, counts, block numbers, addresses) and for small-capital labels (11px,
  0.06em tracking, uppercase). Tabular figures everywhere.
- Newsreader for the wordmark, the card name on the card page, and the sign-in title. Nowhere else.
- Sentence case for all copy. Uppercase only in monospaced labels and table headers.
- US dollars are always formatted for en-US, exact to the cent, with no rounding of a price.

## Layout
- An app, not a website.
  - Desktop: a 248px sidebar (collapsible to 72px), a top bar with search, transaction status, cash and account, and
    a 34px status bar (network, chain block, trade source, theme).
  - Below 1024px: a top bar and a floating bottom tab bar.
  - There is no marketing hero and no site footer inside the app. Browsing never needs an account.
- Every page opens with the same head: title, one line of context, then the page's own actions on the right.
- Radii 8 (controls), 12 (inner panels), 16 (cards and panels), 18 to 20 (dialogs, stage). Spacing steps of 4.
- Card page: the slab on a lit stage on the left. On the right, a sticky buy box with grade picker, lowest ask, best
  offer, Buy now and Make an offer, then market figures, the spread, and trust notes. History, book and trades follow.

## Voice and honesty
- Calm and exact. No exclamation marks, marketing language or filler. Never "audited". Fees read "Currently 0%".
- Card art that is not a photograph of the slab says so. The 3D view says "Rendered view, not a photograph".
- On the test network, custody and verification are named as simulated wherever they appear.

## Never
Emoji, sparkle icons, violet, neon glows, glass cards, gradients beyond the ones above, invented figures or urgency, truncated
prices or grades, auto-rotating carousels, cursor-following effects, a toast for something shown in place.

## Moments
- Every action runs in one centred trade window (a bottom sheet on phones), never a side drawer:
  - review: the slab, the total and the rows;
  - in flight: a turning ring, a live clock and each step;
  - done: a drawn check, the card rising in, the settle time and the block.
- A completed action earns a short confetti burst, and the first time, a badge (First card, Bidder, First sale, Market
  maker, Funded, Self-custody, Sub-second). Badges are stored in this browser.
- Reduced motion turns off the confetti and the movement; the words and the badge still carry the moment.
