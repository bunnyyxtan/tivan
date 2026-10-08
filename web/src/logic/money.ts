// Money. Amounts are integers in base units (bigint), never floating point. USDC has 6 decimals; a price tick is one cent.
// Formatting happens only here, through Intl, and every rounding step names its mode.

export const USDC_DECIMALS = 6
export type Round = 'floor' | 'ceil' | 'halfUp'

const pow10 = (n: number) => 10n ** BigInt(n)

/** n / d as an integer. d must be positive. floor rounds toward -infinity, ceil toward +infinity,
 *  halfUp rounds halves away from zero (so a negative amount rounds the same size as its positive twin). */
export function divRound(n: bigint, d: bigint, mode: Round): bigint {
  if (d <= 0n) throw new RangeError('divisor must be positive')
  const q = n / d // truncates toward zero
  const r = n % d
  if (r === 0n) return q
  const neg = n < 0n
  if (mode === 'floor') return neg ? q - 1n : q
  if (mode === 'ceil') return neg ? q : q + 1n
  const twice = (r < 0n ? -r : r) * 2n
  return twice >= d ? (neg ? q - 1n : q + 1n) : q
}

/** Exact decimal text of a base-unit amount: 5150_000000n -> "5150.000000". */
export function toDecimal(units: bigint, decimals = USDC_DECIMALS): string {
  const neg = units < 0n
  const abs = neg ? -units : units
  const whole = abs / pow10(decimals)
  const frac = (abs % pow10(decimals)).toString().padStart(decimals, '0')
  return `${neg ? '-' : ''}${whole}${decimals ? '.' + frac : ''}`
}

/** Parse what a person typed ("5,150", "$5150.5") into base units. Returns undefined for anything that is not an exact
 *  amount with at most `decimals` places. Never rounds: a typed value either fits exactly or is rejected. */
export function parseAmount(text: string, decimals = USDC_DECIMALS): bigint | undefined {
  const t = text.replace(/[$,\s]/g, '')
  const m = /^(\d+)(?:\.(\d*))?$/.exec(t)
  if (!m) return undefined
  const frac = m[2] ?? ''
  if (frac.length > decimals) return undefined
  return BigInt(m[1]) * pow10(decimals) + BigInt(frac.padEnd(decimals, '0') || '0')
}

/** A price in cents (the market's tick unit) as base units. */
export const centsToUnits = (cents: bigint, decimals = USDC_DECIMALS): bigint => cents * pow10(decimals - 2)
/** Base units to whole cents, with an explicit mode. */
export const unitsToCents = (units: bigint, mode: Round, decimals = USDC_DECIMALS): bigint => divRound(units, pow10(decimals - 2), mode)

export type FormatOptions = {
  locale?: string
  /** 'auto' shows no cents on whole-dollar amounts and two places otherwise. */
  digits?: 'auto' | 0 | 2 | 4
  /** How the digits beyond the shown ones are dropped. Default: halfUp. */
  rounding?: Round
  /** 'always' puts + or the true minus sign on every non-zero amount. */
  sign?: 'auto' | 'always'
}
const INTL_MODE = { floor: 'floor', ceil: 'ceil', halfUp: 'halfExpand' } as const

/** Format a base-unit amount as dollars for display. The only place money becomes text. */
export function formatUsd(units: bigint, o: FormatOptions = {}, decimals = USDC_DECIMALS): string {
  const whole = units % pow10(decimals) === 0n
  const d = o.digits === undefined || o.digits === 'auto' ? (whole ? 0 : 2) : o.digits
  const nf = new Intl.NumberFormat(o.locale ?? 'en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: d,
    maximumFractionDigits: d,
    roundingMode: INTL_MODE[o.rounding ?? 'halfUp'],
    signDisplay: o.sign === 'always' ? 'exceptZero' : 'auto',
  } as Intl.NumberFormatOptions)
  // Intl accepts an exact decimal string, so no bigint is ever squeezed through a float.
  return nf.format(toDecimal(units, decimals) as unknown as number).replace(/^-/, '−').replace(/(?<=^|\D)-(?=\D?\d)/, '−')
}

/** Basis points (1 bp = 0.01%) as a percentage: 580n -> "5.8%". Rounds halves up at the shown digit. */
export function formatBps(bps: bigint, o: { locale?: string; digits?: number; sign?: 'auto' | 'always' } = {}): string {
  const d = o.digits ?? 1
  const nf = new Intl.NumberFormat(o.locale ?? 'en-US', {
    style: 'percent',
    minimumFractionDigits: d,
    maximumFractionDigits: d,
    roundingMode: 'halfExpand',
    signDisplay: o.sign === 'always' ? 'exceptZero' : 'auto',
  } as Intl.NumberFormatOptions)
  return nf.format(toDecimal(bps, 4) as unknown as number).replace(/^-/, '−')
}

/** A quantity of cards ("1", "1,000"). */
export const formatQty = (n: bigint, locale?: string) => new Intl.NumberFormat(locale ?? 'en-US').format(n)
