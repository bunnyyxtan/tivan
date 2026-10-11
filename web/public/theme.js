// Sets the colour mode before first paint so there is no flash. Mirrors apply() in src/fx.tsx.
// A file, not an inline script, so the Content-Security-Policy in vercel.json can refuse every inline script.
try {
  var p = JSON.parse(localStorage.getItem('tivan.prefs') || '{}')
  var t = p.theme === 'light' || p.theme === 'dark' ? p.theme : p.theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  var r = document.documentElement
  r.dataset.theme = t
  r.dataset.appearance = p.theme === 'light' || p.theme === 'system' ? p.theme : 'dark'
  r.style.colorScheme = t
  document.querySelector('meta[name=theme-color]').setAttribute('content', t === 'light' ? '#edf8f2' : '#0b0f0e')
} catch {}
