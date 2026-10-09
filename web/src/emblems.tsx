// Drawn marks, never letters: one medal per badge, and an account emblem built from the address.
// Each is plain SVG so it stays sharp, follows the theme and costs nothing to load.

/** The medal for a badge. The art says what was earned, so the badge reads at a glance. */
export function Medal({ id, size = 52 }: { id: string; size?: number }) {
  const art: Record<string, React.ReactNode> = {
    // a slab with a card inside: the first card owned
    'first-buy': (
      <>
        <rect x="18" y="12" width="28" height="40" rx="4" fill="#3a2a06" opacity=".18" />
        <rect x="19" y="13" width="26" height="38" rx="3.5" fill="#fffdf4" stroke="#8a6a1e" strokeWidth="1.4" />
        <rect x="22" y="22" width="20" height="26" rx="2" fill="#e0b64f" />
        <rect x="22" y="16" width="20" height="4" rx="1.4" fill="#8a6a1e" opacity=".5" />
      </>
    ),
    // an upward arrow into a bid line: an offer on the book
    'first-offer': (
      <>
        <path d="M32 14 L43 29 H36 V46 H28 V29 H21 Z" fill="#fffdf4" stroke="#8a6a1e" strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="17" y="49" width="30" height="4" rx="2" fill="#8a6a1e" opacity=".55" />
      </>
    ),
    // a card turning into coins: the first sale
    'first-sell': (
      <>
        <rect x="14" y="16" width="20" height="28" rx="3" fill="#fffdf4" stroke="#8a6a1e" strokeWidth="1.4" transform="rotate(-10 24 30)" />
        <circle cx="41" cy="38" r="9" fill="#e0b64f" stroke="#8a6a1e" strokeWidth="1.4" />
        <circle cx="41" cy="38" r="4" fill="#fffdf4" opacity=".65" />
      </>
    ),
    // two price levels around a spread: a resting ask
    'first-list': (
      <>
        <rect x="16" y="18" width="32" height="6" rx="3" fill="#fffdf4" stroke="#8a6a1e" strokeWidth="1.2" />
        <rect x="16" y="40" width="32" height="6" rx="3" fill="#e0b64f" stroke="#8a6a1e" strokeWidth="1.2" />
        <path d="M32 27 V37" stroke="#8a6a1e" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
      </>
    ),
    // a filling wallet: cash arrived
    'first-cash': (
      <>
        <rect x="16" y="22" width="32" height="24" rx="5" fill="#fffdf4" stroke="#8a6a1e" strokeWidth="1.4" />
        <path d="M16 30 H48" stroke="#8a6a1e" strokeWidth="1.2" opacity=".5" />
        <circle cx="40" cy="38" r="3.5" fill="#e0b64f" stroke="#8a6a1e" strokeWidth="1.2" />
        <path d="M32 10 V20 M27 15 l5 5 5-5" stroke="#8a6a1e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
    // a key: cash moved to your own wallet
    'first-out': (
      <>
        <circle cx="26" cy="27" r="9" fill="none" stroke="#fffdf4" strokeWidth="3.4" />
        <circle cx="26" cy="27" r="9" fill="none" stroke="#8a6a1e" strokeWidth="1.3" />
        <path d="M31 33 L45 47 M41 43 l4 -4 M37 39 l4 -4" stroke="#fffdf4" strokeWidth="3.4" strokeLinecap="round" />
        <path d="M31 33 L45 47 M41 43 l4 -4 M37 39 l4 -4" stroke="#8a6a1e" strokeWidth="1.3" strokeLinecap="round" />
      </>
    ),
    // an arrow turning back: an order cancelled
    'first-cancel': (
      <>
        <path d="M44 32a12 12 0 1 1-4-9" fill="none" stroke="#fffdf4" strokeWidth="4" strokeLinecap="round" />
        <path d="M44 32a12 12 0 1 1-4-9" fill="none" stroke="#8a6a1e" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M40 13v10h-10" fill="none" stroke="#fffdf4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M40 13v10h-10" fill="none" stroke="#8a6a1e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    // a stopwatch: settled in under a second
    'sub-second': (
      <>
        <circle cx="32" cy="35" r="15" fill="#fffdf4" stroke="#8a6a1e" strokeWidth="1.4" />
        <path d="M32 26v9l6 4" stroke="#8a6a1e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="27" y="13" width="10" height="5" rx="2" fill="#8a6a1e" />
        <path d="M32 18v3" stroke="#8a6a1e" strokeWidth="2.4" />
      </>
    ),
  }
  return (
    <svg className="medal" width={size} height={size} viewBox="0 0 64 64" role="img" aria-hidden focusable="false">
      <defs>
        <radialGradient id="medal-face" cx="32%" cy="28%">
          <stop offset="0%" stopColor="#f8e7b4" />
          <stop offset="100%" stopColor="#c9a24a" />
        </radialGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill="url(#medal-face)" />
      <circle cx="32" cy="32" r="26.5" fill="none" stroke="#8a6a1e" strokeWidth="1.2" opacity=".55" />
      {art[id] ?? <circle cx="32" cy="32" r="10" fill="#fffdf4" />}
    </svg>
  )
}

/** An emblem for an address: a slab-shaped tile with a pattern only that address produces. */
export function Emblem({ address, size = 56 }: { address: string; size?: number }) {
  const n = BigInt(address.slice(0, 18))
  // Kept inside the brand's green-to-teal range, so every emblem belongs to the same family.
  const hue = 120 + Number(n % 80n)
  const cells = Array.from({ length: 15 }, (_, i) => ((n >> BigInt(i * 3)) & 7n) > 3n)
  return (
    <svg className="emblem" width={size} height={size} viewBox="0 0 48 48" role="img" aria-hidden focusable="false" style={{ ['--h' as string]: hue }}>
      <rect width="48" height="48" rx="14" fill={`hsl(${hue} 42% 22%)`} />
      <rect width="48" height="48" rx="14" fill="url(#emblem-sheen)" opacity=".5" />
      <defs>
        <linearGradient id="emblem-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={`hsl(${(hue + 40) % 360} 70% 62%)`} stopOpacity=".55" />
          <stop offset="100%" stopColor={`hsl(${hue} 60% 30%)`} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* mirrored down the middle, so the mark reads as a face rather than noise */}
      {cells.map((on, i) =>
        on ? (
          <g key={i} fill={`hsl(${(hue + 30) % 360} 72% 72%)`}>
            <rect x={10 + (i % 3) * 9} y={9 + Math.floor(i / 3) * 6} width="7" height="4" rx="1.4" />
            <rect x={31 - (i % 3) * 9} y={9 + Math.floor(i / 3) * 6} width="7" height="4" rx="1.4" />
          </g>
        ) : null,
      )}
    </svg>
  )
}
