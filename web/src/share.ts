import { brand } from './config'

/** Draws a price card (the slab photo, the title and the live price) as a PNG, for X and Discord. Client-side only. */
export async function priceCard(opts: { title: string; sub: string; price: string; line: string; img?: string }): Promise<Blob> {
  const W = 1200
  const H = 630
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  await Promise.all(['500 64px Newsreader', '400 28px Geist'].map((f) => document.fonts.load(f).catch(() => [])))
  const css = getComputedStyle(document.documentElement)
  const ink = (v: string) => css.getPropertyValue(v).trim()
  const bg = ink('--canvas')
  const tx = ink('--ink')
  const tx2 = ink('--ink-2')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  // the card, flat and unretouched
  if (opts.img) {
    const im = new Image()
    im.src = opts.img
    await im.decode().catch(() => {})
    if (im.naturalWidth) {
      const h = 520
      const w = (h * im.naturalWidth) / im.naturalHeight
      g.drawImage(im, 210, (H - h) / 2, w, h)
    }
  }
  const X = 640
  g.textBaseline = 'alphabetic'
  g.fillStyle = tx2
  g.font = '500 28px Geist, system-ui, sans-serif'
  g.fillText(opts.sub, X, 190)
  g.fillStyle = tx
  g.font = '500 64px Newsreader, Georgia, serif'
  g.fillText(opts.title, X, 262)
  g.font = '300 150px Geist, system-ui, sans-serif'
  g.fillText(opts.price, X, 420)
  g.fillStyle = tx2
  g.font = '400 30px Geist, system-ui, sans-serif'
  g.fillText(opts.line, X, 478)
  g.font = '600 34px Geist, system-ui, sans-serif'
  g.fillStyle = tx
  g.fillText(brand, X, 568)
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error('card failed'))), 'image/png'))
}

/** Shares the card through the phone's share sheet when it can, else downloads the PNG. */
export async function shareCard(blob: Blob, text: string, url: string) {
  const file = new File([blob], 'tivan-price.png', { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, url })
      return 'shared'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'tivan-price.png'
  a.click()
  URL.revokeObjectURL(a.href)
  return 'saved'
}
