// `mm tivan markets` — the live Kuru book for every graded card Tivan has listed.
// Pure chain reads, so it needs no wallet capability.
import { PluginCommand, type CommandIO } from '@metamask/agent-wallet/plugin'
import { CARDS, bookAbi, live, marketFor, pub, ZERO } from '../../tivan.js'

type Row = { id: string; card: string; grade: number; market: string | null; bid: number | null; ask: number | null }

export default class TivanMarkets extends PluginCommand<{ markets: Row[] }> {
  static description = 'List Tivan graded-card markets on Kuru with their best bid and ask'
  protected readonly pluginCommandId = 'tivan:markets'

  async execute(io: CommandIO) {
    const client = pub()
    const markets: Row[] = []
    for (const c of CARDS) {
      const { market } = await marketFor(client, c.spec, c.grade)
      if (market === ZERO) {
        markets.push({ id: c.id, card: c.name, grade: c.grade, market: null, bid: null, ask: null })
        continue
      }
      const [bid, ask] = await client.readContract({ address: market, abi: bookAbi, functionName: 'bestBidAsk' })
      markets.push({
        id: c.id,
        card: c.name,
        grade: c.grade,
        market,
        bid: live(bid) ? Number(bid) / 1e18 : null,
        ask: live(ask) ? Number(ask) / 1e18 : null,
      })
    }
    for (const m of markets) {
      const px = (v: number | null) => (v === null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
      io.emit(`${m.id.padEnd(9)} PSA ${String(m.grade).padEnd(2)} ${m.card.padEnd(32)} bid ${px(m.bid).padStart(12)}  ask ${px(m.ask).padStart(12)}`)
    }
    return { markets }
  }
}
