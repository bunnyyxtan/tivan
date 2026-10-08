// Measures the colour tokens in src/index.css against the contrast rules in BRAND.md, in both modes.
// Usage: cd web && node scripts/check-contrast.mjs   (exits 1 if any pair fails)
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
const block = (open) => {
  const i = css.indexOf(open)
  return css.slice(i, css.indexOf('\n}\n', i))
}
const read = (b) => Object.fromEntries([...b.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]))
const dark = read(block(':root {'))
const light = { ...dark, ...read(block(":root[data-theme='light'] {")) }

const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (h) => {
  const n = parseInt(h.slice(1), 16)
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// [foreground, background, minimum, note]
const text = (fg, bgs, min = 4.5) => bgs.map((bg) => [fg, bg, min])
const pairs = (t) => [
  ...text('text-primary', ['canvas', 'surface-1', 'surface-2', 'surface-3']),
  ...text('text-secondary', ['canvas', 'surface-1', 'surface-2', 'surface-3']),
  ...text('text-tertiary', ['canvas', 'surface-1', 'surface-2', ...(t === 'dark' ? ['surface-3'] : [])]),
  ...text('action-label', ['action-solid', 'action-hover', 'action-pressed']),
  ...text('chip-selected-label', ['chip-selected-fill']),
  ...text('accent-text', ['canvas', 'surface-1', 'surface-2']),
  ...text('brass', ['canvas', 'surface-1'], 3),
  ...text('positive', ['canvas', 'surface-1', 'surface-2']),
  ...text('negative', ['canvas', 'surface-1', 'surface-2']),
  ...text('warning', ['canvas', 'surface-1', 'surface-2']),
  ...text('negative-label', ['negative']),
  ...text('border-input', ['canvas', 'surface-1'], 3),
]

let fails = 0
for (const [mode, tokens] of [['dark', dark], ['light', light]]) {
  for (const [fg, bg, min] of pairs(mode)) {
    if (!tokens[fg] || !tokens[bg]) {
      console.log(`${mode.padEnd(5)} missing token ${fg} or ${bg}`)
      fails++
      continue
    }
    const r = ratio(tokens[fg], tokens[bg])
    const ok = r >= min
    if (!ok) fails++
    console.log(`${mode.padEnd(5)} ${ok ? 'pass' : 'FAIL'} ${r.toFixed(2).padStart(5)} (min ${min})  ${fg} ${tokens[fg]} on ${bg} ${tokens[bg]}`)
  }
}
console.log(fails ? `\n${fails} pair(s) failing` : '\nall pairs pass')
process.exit(fails ? 1 : 0)
