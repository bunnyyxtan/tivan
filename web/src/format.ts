// One place for how money, change and percentages read, so every screen formats a value the same way.

/** $5,150 (or $5,150.25 with digits). A missing value reads as a dash, never as zero. */
export const money = (n: number | undefined, digits = 0) =>
  n === undefined ? '—' : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Signed dollar difference: +$200, −$800 (true minus sign). */
export const signed = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}${money(Math.abs(n))}`

/** A fraction as a percentage: 0.058 becomes 5.8%. */
export const pct = (fraction: number, digits = 1) => `${(fraction * 100).toFixed(digits)}%`

/** A fraction as a signed percentage: +5.8%, −2.0%. */
export const signedPct = (fraction: number, digits = 1) => `${fraction < 0 ? '−' : fraction > 0 ? '+' : ''}${pct(Math.abs(fraction), digits)}`

/** Unix seconds as "Oct 6, 11:57 PM". */
export const stamp = (t: number) => new Date(t * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
