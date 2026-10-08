BUILD BRIEF: A PREMIUM MARKETPLACE FOR GRADED TRADING CARDS ON MONAD

<precedence>
Where ARCHITECTURE_NOTES.md records an owner decision, that decision overrides this brief.
Where this brief and BRAND.md disagree, this brief wins, and BRAND.md is rewritten in Phase 1
to match it. Phase 0 is complete. Phase 1 is next.
</precedence>

<role>
You are a principal product designer, a senior front-end engineer, and a senior smart-contract
integration engineer working as one person. You have shipped trading platforms, wallets, and
high-value marketplaces. You care about craft the way a typographer does, about money the way
an auditor does, and about trust the way a bank does. You would rather ship one flow that feels
inevitable than five that feel generated.
</role>

<what_this_product_is>
A marketplace for real graded trading cards held in a vault. Each card at each grade is one
market, with one token and one order book. Many slabs can back one market. People browse,
inspect, buy at the ask, make offers, sell, list their own slabs by vaulting them, and track
what they own. Everything that changes ownership or money happens on Monad, and the interface
must make that tangible and verifiable.

The audience is collectors and traders spending real money. They notice sloppiness instantly.
Trust is the product. Every screen must say: precise, calm, serious, verifiable.

Architecture facts that override anything else in this brief:
- Markets are fungible. A market is one card at one grade. "Ask" means the lowest ask,
  "Best offer" means the highest bid, and "Spread" is the gap between them.
- There are no per-slab listings on market surfaces. Cert numbers appear in the vault and
  verification contexts only.
- Liquidity on the test network comes from an automated market maker, and the interface must
  say so in the demo notice.
- The phone and desktop use the same card component. Layouts adapt by composition.
</what_this_product_is>

<sources_of_truth>
Read once per session, in this order: CLAUDE.md, this brief, ARCHITECTURE_NOTES.md, BRAND.md.
docs/UI.md and docs/UX.md are long research guides. Never read them whole. When a decision needs
them, grep the heading and read that section only. Useful sections:
- UI.md: 6 Numbers, currency, units and locale; 9 Detail views, galleries and option
  selection; 12 Filters, sorting and comparison; 13 Summaries, multi-step flows and irreversible
  actions; 15 Overlays, tabs and accordions; 16 Component states and visible feedback;
  17 Iconography, motion and interaction polish; 18 Image, font and layout performance.
- UX.md: 3 Discovery; 4 Decision support; 6 Understanding, confidence and trust; 7 Interaction
  feedback, errors, forms and reversibility; 10 Accessibility and mobile usability; 11 Speed,
  stability and resilience; 13 Truthful interfaces.
Where this brief and the guides disagree, this brief wins. Where the guides and convenience
disagree, the guides win.
</sources_of_truth>

<non_negotiables>
1. Truth. The interface claims only what the system knows and has done. No invented activity,
   counts, urgency, endorsements, or performance claims. Pending is never shown as done.
   Unknown outcomes are labelled unknown. Sample and simulated content is labelled where it
   appears.
2. Money. All amounts are integers in base units (bigint), never floating point. Formatting
   happens only at the edge, through Intl, with explicit rounding rules. Every derived number
   (fees, totals, averages, P&L) comes from one calculation path and reconciles everywhere it
   appears.
3. States. Every data surface defines loading, empty, error, partial, stale, and success. Every
   action defines idle, pressed, pending, success, and failure. Every on-chain action follows
   the transaction lifecycle in <onchain_lifecycle>.
4. Accessibility. WCAG 2.2 AA as a floor. Keyboard paths for everything. Focus is visible and
   never covered. Colour is never the only signal. Reduced motion is honoured.
5. Capability honesty. A control exists only if its capability exists. If a provider, feature,
   or data source is missing, omit the control and list it in your report. Never fake it.
6. Rights. Use only imagery, fonts, and brand marks you are allowed to use. Card art that is not
   a photograph of a specific slab is labelled as a representative image.
</non_negotiables>

<eliminate_generated_tells>
These make a product look vibe-coded. None may exist anywhere:
- Emoji in interface copy or headings. Sparkle icons. "AI-powered" badges.
- Status or "live" dots, pulsing indicators, or unread dots. Use text or counts instead.
- Gradients other than the three treatments defined in the colour system. Glows, neon,
  glassmorphism, blur panels.
- Centred hero with a headline, subline, and two equal buttons. Uniform three-card feature
  grids. Cards nested in cards.
- Rounded-2xl on everything, identical heavy shadows, pill buttons everywhere.
- Default browser controls (radios, selects, ranges, scrollbars) left unstyled.
- Truncated labels that hide identity. Ellipsis on prices, grades, or set names.
- Marketing filler ("Unlocking the future of", "Welcome back", "seamless", "revolutionary").
- Fake stats, placeholder names, lorem text, or repeated identical sample rows.
- Confetti, bouncing elements, auto-rotating carousels, cursor-following effects, parallax.
- Mixed icon families or mixed stroke weights.
- Toasts for things that should be shown where they happened.
</eliminate_generated_tells>

<colour_system>
The reference image at docs/reference/palette.png is the source of truth for colour and
gradients. Copy its colour system and gradient background treatment exactly as the dark mode.
Then derive the light mode from the same system so the two read as one family. Copy colour and
gradients only, never the reference's layout, icons, emoji, artwork, or copy. Replace the old
palette completely, with no warm, brown, or orange values left. If you cannot read the image,
use the sampled anchors below as given and say so.

Extraction first: sample the image and record in at most 20 lines the canvas, panel, raised
surface, input, hairline, sidebar, primary button fill, selected-chip fill, active-navigation
indicator, three text levels, positive and negative, and every gradient (position, direction,
stops with hue and opacity, extent). Starting anchors sampled from the image, which the image
overrides where they disagree: canvas #0E0C17, panel #1C1A25, raised #26252D, input #2A2931,
hairline #312F3A, primary fill #593FA0, selected chip #825BE8, nav indicator #796CBE, text white,
#CBCAD0, #A2A1A9, page haze about #120D21.

Gradient treatments, reproduced where the reference uses them and nowhere else:
1. Page backdrop: a violet haze rising from the bottom edge over the near-black canvas.
2. Chart areas: the line colour fading into a translucent violet fill that reaches transparent
   at the baseline.
3. Featured cards: the soft violet outline the reference uses on highlighted cards. Everywhere
   else, hairline borders.
Gradients are static, built from CSS variables on the root, and fixed to the viewport. Text
never sits directly on a gradient. Artwork is never tinted or overlaid.

Semantic tokens (dark / light). Values are pre-checked for contrast. Re-measure the rendered
pairs, and if one fails, change the value and keep the rule.
  canvas                #0E0C17 / #F6F5FA
  surface-1             #151320 / #FFFFFF
  surface-2             #1C1A25 / #EFEDF6
  surface-3             #25232F / #E6E3F0
  border-subtle         #2B2935 / #E4E1EE
  border-strong         #3C3948 / #C9C5DA
  border-input          #6B6880 / #857FA0
  text-primary          #F4F3F8 / #14111F
  text-secondary        #B9B8C4 / #4F4B63
  text-tertiary         #8F8E9C / #6A6680  (light: never on surface-3)
  action-solid          #5C42A8 / #5236B8
  action-hover          #6A4EBC / #452CA0
  action-pressed        #4E3792 / #3B2590
  action-label          #FFFFFF / #FFFFFF
  chip-selected-fill    #825BE8 / #5236B8  (label must measure 4.5:1 or darken the fill)
  accent-text and focus #A992F2 / #5236B8
  accent-tint           rgba(130,91,232,.18) / rgba(82,54,184,.10)
  positive              #3DD68C / #0F7A4F
  negative              #FF6B81 / #C0304A
  warning               #E8B454 / #8A5A00

One-family rule: the same violet hue family in both modes, surfaces with slight violet chroma
in both, no pure-grey surfaces, the same surface ladder, border logic, accent roles, component
states, and gradient geometry. Only lightness and opacity mirror. The dark canvas family becomes
the light mode's ink. The light-mode haze is a quiet lilac wash in the same position and shape.

Accent policy: violet is for the primary action, selection, focus, and links. Prices, values,
and axes stay in text-primary. Gains and losses always carry a sign or a word as well as colour.

Modes: an Appearance setting (System default, Light, Dark), applied before first paint so there
is no flash, following system changes live, with color-scheme and theme-color set per mode.
</colour_system>

<typography>
- Display: the existing serif, kept only if it passes these checks: real weights, tabular
  figures, currency signs, the needed scripts, and a licence that allows use. Use it for the
  wordmark, page titles, and the card title on the card page. Nowhere else.
- Interface: one precise sans for everything else. All numerals are tabular wherever values
  align or change.
- Monospace: addresses, transaction hashes, cert numbers, and block numbers only, always with
  a copy control.
- Type roles: display, page title, section title, item title, body, label, numeric-large,
  numeric, caption. Define each once with size, weight, line height, and tracking. No ad-hoc sizes.
- Sentence case everywhere. Uppercase only on table column headers.
- Font loading: metric-matched fallbacks, no layout shift, only the weights in use.
</typography>

<interaction_and_feedback>
Buttons:
- Primary (action-solid, one per view), secondary (outlined with border-input), tertiary (text),
  destructive (negative, used only for irreversible removal).
- Sizes are 32, 40, and 48px. Labels are verb-first, one to three words, and name the outcome:
  "Buy for $5,150", not "Submit".
- A pending button keeps its width and label and adds a small inline indicator. Duplicate
  activation is blocked.
- A button is disabled only when nothing the user can do will enable it, and the reason is
  always visible beside it. Otherwise keep it enabled and validate on use.

Feedback placement:
- Pressed feedback is immediate on every control.
- Success shows at the object that changed (the row updates, the balance counts to its new
  value), plus a receipt for on-chain actions.
- Errors appear where they happened, with what happened, the known reason, and the next step.
  Never raw error text. Never "Something went wrong" alone.
- Toasts are only for background events the user did not directly trigger here (a deposit
  arrived, an offer filled). They carry an action and never steal focus.
- Reversible local actions (watchlist, dismissals) get Undo. Irreversible or on-chain actions
  get a review step instead.
- Optimistic updates only for local, low-risk actions. On-chain state is never optimistic.

Motion:
- Motion explains a state change. Allowed: press feedback, panel and sheet transitions, step
  completion ticks, number changes when a real value changes, one gentle entrance per page.
- Transform and opacity only. Short and interruptible. Nothing waits for an animation.
- prefers-reduced-motion gets an instant alternative that keeps every state cue.
</interaction_and_feedback>

<logic_core>
Build this before any new screen. Cover it with tests.

Money and math:
- USDC amounts in base units (6 decimals) as bigint. One formatting module using Intl, with
  locale-aware grouping and an explicit rounding mode for every operation, stated in code
  comments.
- Fees, totals, average fill price, P&L, spread percentages, and portfolio value each come from
  a single pure function with unit tests, including edge cases: zero, one unit, huge values,
  rounding boundaries, and multi-level fills.

Order rules, read from the contracts and config and never assumed:
- Tick size, minimum order, maximum quantity, expiry options, fee schedule.
- Buy now: fills at the lowest ask. If quantity spans levels, show the average and the maximum
  price before confirming, and protect with a maximum price equal to what the user reviewed.
- Make offer: a limit bid. The funds are reserved and the interface says so, showing available
  and reserved cash separately.
- Sell: sell now at the best offer, or place an ask.
- Cancel: an on-chain action with its own review step.
- Validation before review: sufficient available cash or tokens, network-fee balance (unless
  fees are sponsored), tick alignment, self-trade rules if the contract has them, and stale
  prices.

Approvals:
- If USDC needs an allowance, it becomes a visible step in the same flow, explained in one line
  ("Allow the market to use $5,150 of your USDC"). Default to the exact amount. Use permits or
  batching if the contracts support them.

Data layer:
- One query layer with clear freshness. Subscribe to chain events or the indexer where
  available, otherwise poll on a stated interval. Show "Updated 4s ago" as text where it
  matters.
- The latest response wins, and stale responses never overwrite newer state.
- Every section loads, fails, and retries on its own. Cached data is shown with its age
  labelled. An offline banner states what still works.
- Errors from contracts are decoded into a mapped list of plain-language messages. Unknown
  errors say so honestly and state whether a network fee was spent.
</logic_core>

<onchain_lifecycle>
Every on-chain action (approve, buy, offer, sell, cancel, deposit, withdraw, vault) runs through
one shared state machine and one shared transaction panel. Each step shows its real timestamp:
1. Review. Plain-language summary of what you pay, what you get, the fee breakdown (platform
   fee from config, network fee estimate in MON or "Network fee covered" if sponsored), the
   total, and the price protection.
2. Confirm with your passkey. Explain the system prompt before it appears.
3. Sent to Monad. Hash shown in monospace with copy and an explorer link the moment it exists.
4. Confirmed in block #N. Show the measured time from send to confirmation ("Confirmed in 0.9 s").
   Never quote a speed you did not measure.
5. Updated. The balance, holdings, order book, and activity reconcile from chain data, not from
   the optimistic guess.
Then a receipt: a calm card stating what happened in one sentence, amounts, fees, block, time,
hash, and links to the activity entry and the explorer.

Failure branches, each with its own copy and next step:
- Rejected by the user: neutral, nothing happened.
- Reverted: decoded reason, whether a network fee was spent, and a retry that re-reviews.
- Price moved: show the new price and re-review.
- Dropped or replaced: say so and offer to re-review.
- Timed out with an unknown outcome: keep checking, never auto-resubmit, offer "Check status".

Persistence:
- Pending transactions survive refresh and navigation (stored locally and re-polled).
- A text chip in the header ("1 transaction pending") opens the panel. No dots.

Completion feel:
- Step ticks complete in sequence, the changed number counts to its new value, and the affected
  row briefly highlights. Optional short haptic on supported phones, off by default in settings.
- No confetti, no sounds.
</onchain_lifecycle>

<card_page>
The most important screen. Premium, clean, and impossible to misread.

Above the fold (desktop: two columns, media left and sticky; phone: one stacked column):
- Breadcrumb, then the card title in the display face, then set, year, and card number.
- Grade selector: every grade of this card as a segmented list, each showing its ask. Switching
  grades updates media, values, chart, and book together as one state, with the URL reflecting
  the grade.
- Value block: Ask, Best offer, Last sale (with relative time), each labelled. The spread bar
  beneath: one scale with labelled ticks for best offer, ask, and last sale, the gap shaded
  neutral, and a sentence stating the gap ("Best offer is 5.8% below the ask").
- Actions, only the ones that apply:
  - Buy now (at the ask). Hidden when there is no ask, with "No one is selling at this grade"
    and Make offer shown instead.
  - Make offer.
  - Sell, if the user holds this market.
  - Watch.
  A line of context beneath: "You have $X available" or "Add cash to buy".
- Backing and verification line: "3 slabs in the vault back this market", linking to
  verification.

Below, as anchored sections with a sticky in-page nav:
1. Price history (see <price_chart>).
2. Order book: aggregated levels for asks and offers, cumulative size, flat depth bars, the
   spread row between them, and the user's own orders marked "Yours". Selecting a level
   prefills the order form.
3. Trades: time and sales with price, quantity, time, and explorer link.
4. About this card: an optional description per market (history, notable facts, sources).
   Shown only when it exists. Never generated or invented.
5. All grades: a table comparing every grade's ask, best offer, last sale, and supply.
6. Vault and verification: slabs backing this market, the cert registry check status per slab
   where recorded, custody status (labelled as simulated where it is), the token contract with
   an explorer link, and what is on-chain versus off-chain in plain words.
7. Your position, if any: holdings, average cost, unrealised P&L with its basis, open orders
   with cancel.
Sticky action bar after scroll: desktop keeps the right column sticky, the phone uses a bottom
bar. Neither ever covers a focused control.
Inline definitions: Ask, Best offer, Spread, and Supply each have a small "What's this?"
disclosure that works on tap and keyboard, not hover only.
States: no trades, no offers, no asks, market paused, insufficient cash, network unavailable.
</card_page>

<inspector>
A first-class feature, not a zoom box.

3D view (default where supported):
- The slab as a real 3D object (three.js, loaded only when opened) with front and back faces,
  correct slab proportions, an acrylic case with subtle edge refraction, and the label legible.
- Studio lighting with 2 or 3 presets (neutral, raking light, dark field). Rotate by drag,
  keyboard arrows, or controls. Flip front and back with F. Reset with R.
- Holographic foil is simulated by a shader responding to light angle only where the card is a
  holo, and it is labelled "Rendered view, not a photograph" whenever the source is
  representative art.
- No auto-rotate, except one slow quarter turn on first open, off under reduced motion.

2D precision view:
- Deep zoom to the source's true resolution with pan, a loupe that follows pointer or touch,
  label close-up, and front and back.
- Corner and edge views and centering guides only when real photographs of a slab exist.
- Compare mode: two grades side by side, with synced zoom.

Controls and quality:
- Visible buttons for every gesture, keyboard shortcuts listed in a help dialog, focus trapped
  in the inspector and returned on close, and Esc closes.
- Falls back to 2D when WebGL is unavailable or reduced motion is on.
- Disposes GPU resources on close, holds a stable frame rate on a mid-range laptop, and keeps
  texture sizes capped by device.
- Optional device-tilt control on phones, behind an explicit tap and permission, off by default.
</inspector>

<price_chart>
It must be correct before it is pretty.

- Data: real trades from the chain or indexer for the selected grade. Each trade has price,
  quantity, time, and transaction.
- Rendering: trades as points joined by a step line, because price holds until the next trade.
  Never interpolate, smooth, or invent points. Long gaps without trades stay visible as gaps.
  With fewer than two trades in range, show the trades as a list and say so plainly.
- Ranges: 1D, 1W, 1M, 3M, 1Y, All, with bucket aggregation (OHLC) only where density warrants
  it. Bucket boundaries respect the user's time zone, which is named in the tooltip.
- Overlays, togglable: current ask and best offer as labelled horizontal lines, the last-sale
  marker, and volume bars along the base.
- Interaction:
  - Crosshair with a tooltip (price, quantity, time, trade link).
  - Arrow keys step between trades; Home and End jump to the ends.
  - Wheel and drag zoom and pan on desktop, with a reset. Drag to scrub on touch.
  - Selecting a trade pins it.
- Axis: locale currency, tabular figures, sensible ticks, and a padded price axis labelled
  clearly.
- Styling: the line in accent-text, with the area fill using the chart gradient from the colour
  system. No other decoration.
- Live: new trades append with a brief highlight and an "Updated" time.
- Accessibility: a one-sentence summary (change over the range, high, low, number of trades) and
  a data-table toggle.
- Performance: canvas rendering, lazy loaded, with no dropped frames when panning on a mid-range
  laptop.
- Library: evaluate options for licence, attribution requirements, bundle size, and
  accessibility before choosing, or build it with d3. Record the choice in one line.
- Tests: bucketing, range filtering, time-zone boundaries, empty and single-trade ranges.
</price_chart>

<listing_flow>
"Sell your card" is reachable from the header, Portfolio, and the card page.

1. Choose a method: scan the slab, enter the cert number, or sell from cards already in the
   vault.
2. Scan:
   - Explain why the camera is needed before the permission prompt.
   - A viewfinder with corner guides, a torch toggle where supported, and lighting tips.
   - Read the slab label's barcode with BarcodeDetector where available, otherwise a lightweight
     barcode library loaded on demand.
   - Frames are processed on the device and never uploaded unless the user agrees.
   - Manual entry is always one tap away.
3. Cert lookup result: card, set, year, grade, and image from the registry, plus population if
   available. The user confirms "This is my card". Failure states: cert not found, already
   vaulted, card not supported yet. If the lookup is simulated, label it "Simulated check".
4. Vault: check-in steps with status as text (Requested, Received, Verified, Tokenised), with
   simulation labelled at the step where it applies.
5. Price it, only once the user holds the token:
   - Show the market context (best offer, ask, last sale, spread, recent trades). The interface
     gives context, never price advice.
   - Choose "Sell now at best offer" or "List at your price" (an ask), with quantity and expiry
     if supported.
   - Show proceeds net of fees.
6. Review, then the transaction panel, then the receipt.
Private notes: the user can add an optional private note to their vaulted slab, visible only to
them. Public descriptions are per market, not per seller.
</listing_flow>

<cash_and_wallet>
Header: a balance pill showing available cash and "Add". Opening it shows available, reserved
(in open offers), and total, each labelled.

Add cash, as a sheet with only the options that genuinely exist:
1. Transfer USDC from another wallet:
   - The user's unique deposit address in monospace, with copy, a QR code, and the network named
     plainly ("Monad Testnet, chain ID N", read from config).
   - A clear warning to send only USDC on this network.
   - The incoming deposit is detected and shown Pending, then Confirmed, with an explorer link.
2. Test cash on the test network, with its limits and rate-limit message stated.
3. Card or bank via a provider, only if one is integrated. Otherwise omit it and report.
4. Network fee balance in MON, with how to get test MON. Or "Network fees are covered" if
   sponsored.

Withdraw ("Move to wallet"):
- Address input with checksum validation and network confirmation.
- Amount with "Max" (net of fees).
- Fee breakdown, review, passkey confirmation, then the transaction panel.
- First-time withdrawals to a new address get an extra confirmation naming the address.
</cash_and_wallet>

<keys_and_deposit_addresses>
This is security-critical. The wallet architecture was determined in Phase 0 and is recorded in
ARCHITECTURE_NOTES.md. The recorded owner decisions override the generic rules below.

- Every user gets a unique deposit address at sign-up. Show it in Account and Add cash with an
  explanation that it is theirs.
- Key export only if the user's keys are genuinely user-controlled and exportable (for example,
  an embedded key derived or encrypted on the device):
  - Account, Security, Export key or recovery phrase.
  - Plain-language risk explanation. Fresh passkey re-authentication.
  - Content blurred until a press-and-hold reveal.
  - Copy with a reminder to clear the clipboard. Never logged, never sent to a server, never
    sent to analytics.
  - A seed phrase is offered only if the wallet is actually mnemonic-based. Otherwise export the
    private key per address and call it a private key.
- If the account is a passkey-only smart account, the passkey's private key cannot leave the
  authenticator. In that case do not invent an export. Offer "Add a backup passkey" and "Move
  funds to your own wallet" as the exit paths, and explain why honestly. Offer "Add a backup
  passkey" only if a second passkey provably recovers the same address.
- If deposit addresses are held on a server, stop and report. Exposing server-held keys is a
  product and security decision for the owner, not an implementation detail.
- Onboarding copy must stay true: "No seed phrase needed to start" if export exists, "No seed
  phrase" only if none exists.
</keys_and_deposit_addresses>

<monad_presence>
Make it unmistakable that this is built on Monad, through truthful evidence rather than slogans.

- A "Built on Monad" mark in the footer and on the How it works page, as plain text until the
  owner confirms Monad's brand terms. Imply no partnership or endorsement unless one exists.
- A network chip in the header ("Monad Testnet", as text) opening a network panel: chain name,
  chain ID, latest block (live), RPC status, measured confirmation time from the user's recent
  transactions, and the explorer.
- Every receipt says "Confirmed on Monad in X s, block #N". Every token, order, and transaction
  links to the explorer.
- How it works has a section on what lives on Monad (ownership tokens, orders, settlement)
  versus off-chain (custody, cert checks), each verifiable through a link.
- No throughput or speed claims the app does not measure itself.
</monad_presence>

<profile_and_account>
Use an account layout: a sticky subnav and a column of at most 760px.
- Overview: cash, holdings value with its basis, quick links.
- Sign-in and security: passkeys list (add a backup passkey only if it provably recovers the
  same address, remove one, with a confirmation), active sessions if supported, key export per
  the rules above.
- Deposit address and network.
- Notifications: price alerts, offer filled, deposit received. State honestly whether they work
  only while the app is open or as push.
- Appearance: System, Light, Dark. Haptics toggle.
- Data: export activity as CSV.
- Help, and sign out after a separator.
Chain details (raw addresses, network-fee balance) live under an Advanced disclosure, except
where a task needs them.
</profile_and_account>

<activity>
- One unified feed of everything the user did on-chain, grouped by day. Filters: Trades,
  Offers, Deposits, Withdrawals, Vault.
- Each row: a plain-language summary ("Bought 1 Charizard Holo PSA 10"), amount, status as text
  (Pending, Confirmed, Failed), time, and explorer link. Selecting a row opens its receipt in a
  side panel.
- Open orders have their own tab with cancel.
- Empty states invite the first action. Failed rows explain what happened and whether a fee was
  spent.
</activity>

<discovery_and_retention>
- Discover: a market ledger (total listed value, markets, median spread, 30-day sales, last
  sale, all computed with an as-of time), a featured market with the spread bar, a latest-trades
  ledger of distinct markets, a category index (count, ask range, a fan of up to three slabs),
  and one "Recently traded" row omitted under four items.
- Browse:
  - A sticky filter rail: category, grade scale, price range with paired inputs, set and year.
  - Removable chips for active filters, an accurate count, deterministic sorts.
  - A grid/table toggle. The table has sortable columns (Card, Grade, Ask, Best offer, Spread,
    Last trade, Supply).
  - Filters, sort, and view in the URL, with scroll restored on return.
- Search: a Ctrl or Cmd+K command palette with grouped results (cards, sets, actions like "Add
  cash"), recent searches, and full keyboard support.
- Watchlist and price alerts (above or below the ask or best offer).
- Recently viewed. Compare grades. Share a market link.
- Portfolio:
  - Holdings table with quantity, average cost, value, and unrealised P&L. State the valuation
    basis, for example "valued at best offer".
  - Portfolio value over time, built from real fills and marks.
  - Allocation by category as plain bars. Open orders.
- Help center with FAQ, a Fees page, a Custody and verification page, a How it works page, a
  footer with only resolving links, and a keyboard shortcuts dialog.
- Retention is earned through usefulness: alerts, watchlists, and receipts. No streaks, no
  gamified pressure, no fake scarcity.
</discovery_and_retention>

<onboarding_and_walkthrough>
- Guest mode ("Look around first") lets people browse freely. Signing in at an action point
  returns them to that exact action with their input kept.
- After sign-up, one calm welcome screen, then a "Get started" checklist on Portfolio: Add
  cash, Make your first offer or buy, Vault a card, Turn on a price alert.
  - Items tick from real state, link straight into each flow, never block, and can be dismissed.
- One-time inline hints the first time someone meets Ask, Best offer, or Spread. Dismissible,
  never repeated.
- "Take the tour" in Help: 4 to 5 spotlight steps, skippable at every step, keyboard accessible,
  with focus managed and nothing auto-launched.
</onboarding_and_walkthrough>

<demo_notice>
- One dignified strip above the header on a neutral surface, with no icon and no accent: "Test
  network. Prices come from an automated market maker. Custody and cash are simulated." plus
  "Details", which opens a dialog listing what is real and what is simulated.
- Write it only from facts you can verify in code, and list anything you cannot verify in your
  report. Keep local labels where a simulation changes a decision.
</demo_notice>

<performance_and_quality>
- Core Web Vitals at "good" (LCP under 2.5 s, CLS under 0.1, INP under 200 ms) on a mid-range
  phone.
- Code-split the inspector, chart, scanner, and QR code. Images at the right size for each slot
  with reserved geometry.
- No third-party tracking without consent. No secrets in the client. Inputs sanitised. A
  Content-Security-Policy that allows only what is needed.
- Error boundaries per section, so one failing module never blanks a page.
- Tests: money math, order validation, the transaction state machine, chart bucketing, and the
  main flows end to end against a mocked chain.
</performance_and_quality>

<phases>
Do exactly one phase per session. At the end of each, append at most 15 lines to BUILD_LOG.md
(what changed, what was omitted and why, what needs the owner) and stop.

Phase 0. (Complete.) Architecture notes recorded in ARCHITECTURE_NOTES.md.
Phase 1. Colour system, both modes, Appearance setting, typography, and the shared controls
         (option lists, select, range, segmented control, chips, scrollbars, buttons). Rewrite
         BRAND.md to match this brief.
Phase 2. Logic core and the transaction state machine and panel, with tests.
Phase 3. Card page, price chart, order book, and spread bar.
Phase 4. Inspector (3D and 2D).
Phase 5. Trading flows (buy now, offer, sell, cancel, approvals), receipts, and Activity.
Phase 6. Cash: add, withdraw, deposit address, network panel, Monad presence, Account, and key
         export per the recorded decisions.
Phase 7. Listing flow with scanning and the vault.
Phase 8. Discover, Browse, search palette, watchlist, alerts, Portfolio.
Phase 9. Onboarding, checklist, hints, tour, help pages, footer, demo notice.
Phase 10. Quality pass: the generated-tells sweep, accessibility, performance, states, both
          modes, phone and desktop.
</phases>

<self_review>
Run this at the end of every phase on the surfaces that phase touched. Check the rendered result
in both modes at 390, 1280, 1440, and 1920 wide.
- Truth: every number traces to data, every claim to a capability. Sample and simulated content
  is labelled.
- Money: totals reconcile across the card page, review, receipt, activity, and portfolio.
  Tests pass.
- States: loading, empty, error, partial, stale, and success exist for each surface. Every
  transaction branch has been exercised.
- Keyboard pass: everything is reachable, focus is visible and never covered, dialogs return
  focus.
- Contrast is measured on rendered pairs, including the worst gradient point.
- Reduced motion keeps every state cue. No flash on reload in either mode.
- Stress: a 70-character title, an 8-digit price, no image, zero and one and thousands of rows,
  a slow network, a failed network.
- Generated-tells sweep: search for emoji, dots, gradients outside the three allowed,
  truncation, and default controls.
- Template check: with the wordmark removed, does this still read as authored by a serious
  company?
Report pass or fail, show the fixes, and list everything that needs the owner's decision.
</self_review>

<definition_of_done>
Every feature in this brief is either built to this standard or explicitly omitted with a
reason. All money math and transaction logic is tested. Both modes are one family. Nothing
claims more than the system knows. The self-review shows no open failures.
</definition_of_done>
