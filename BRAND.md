# Tivan brand: Ink and Brass

Personality: precise, calm, serious, verifiable. A vault and an exchange, not a game store. Trust is the product.
This file replaced the violet system on 2026-10-08, when the owner asked for a redesign from scratch with full freedom,
dark-first, in a classic style with no AI look. Tokens live in `web/src/index.css` (`:root`, then
`:root[data-theme='light']`), and `web/scripts/check-contrast.mjs` measures every text, action and chip pair in both modes.

## Colour
- Ink, dark and the default: near-black neutral surfaces with no hue. canvas #0A0A0B, surface-1 #111113,
  surface-2 #18181B, surface-3 #222226, borders #232327 and #34343A, input border #6C6B72.
- Paper, light: canvas #F7F6F2, surface-1 #FFFFFF, surface-2 #F2F0EA, surface-3 #E9E6DE.
- Text is warm ivory in dark mode (#F3F1EA, #B3B0A8, #8E8B84) and warm ink in light mode (#141311, #4B4842, #6B675F).
- The primary action is solid ivory with ink text in dark mode, and solid ink with white text in light mode.
- Brass is the one signature colour (#C9A86A, text #D6B77C; light #9A7634, text #7C5E25). Use it for the wordmark
  mark, focus rings, the selected-navigation marker, links, and the "featured" and "yours" marks. Nowhere else.
- Green and red mean price direction only (#3FCF8E and #FF6B6B; light #0F7A4F and #C0304A). They always sit next to a
  sign or a word, and on a faint tint when shown as a change chip.
- Allowed gradients:
  - the slab stage, a soft radial light behind card art;
  - the chart fill, which fades to transparent;
  - the skeleton sheen.

  Nothing else uses a gradient.
- Allowed shadows: overlays (menus, dialogs, drawers, the phone tab bar) and slabs on a stage. The top bar and the
  phone tab bar may blur what scrolls beneath them. Nothing glows.

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
Emoji, sparkle icons, violet or neon, glass cards, gradients beyond the three, invented figures or urgency, truncated
prices or grades, confetti, auto-rotating carousels, cursor-following effects, a toast for something shown in place.
