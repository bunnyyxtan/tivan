import { useEffect, useState } from 'react'
import { indexerUrl } from './config'
import { pub } from './chain'
import { NetworkChip } from './Cash'
import { usePrefs, type Theme } from './fx'

/** The thin bar under the app: which network, whether the chain is answering, where trades come from, and the theme. */
export function StatusBar() {
  const [block, setBlock] = useState<bigint>()
  const [down, setDown] = useState(false)
  const [prefs, setPrefs] = usePrefs()
  useEffect(() => {
    let live = true
    const read = () =>
      pub.getBlockNumber().then(
        (b) => live && (setBlock(b), setDown(false)),
        () => live && setDown(true),
      )
    read()
    const id = setInterval(read, 15_000)
    return () => ((live = false), clearInterval(id))
  }, [])
  const themes: [Theme, string][] = [['dark', 'Dark'], ['light', 'Light'], ['system', 'System']]
  return (
    <footer className="statusbar" aria-label="Status">
      <NetworkChip />
      <span className={`sb-item ${down ? 'bad' : block ? 'ok' : ''}`} role="status">
        <i aria-hidden />
        {down ? 'Reconnecting to the network' : block ? `Block ${block.toLocaleString('en-US')}` : 'Connecting'}
      </span>
      <span className="sb-item sb-wide">Trades from {indexerUrl ? 'the Envio indexer' : 'recent chain logs'}</span>
      <span className="sb-gap" />
      <div className="sb-theme" role="radiogroup" aria-label="Theme">
        {themes.map(([v, l]) => (
          <button key={v} role="radio" aria-checked={prefs.theme === v} onClick={() => setPrefs({ theme: v })}>
            {l}
          </button>
        ))}
      </div>
    </footer>
  )
}
