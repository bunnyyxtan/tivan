// `mm tivan markets` — the live Kuru book for every graded card Tivan has listed.
// Pure chain reads, so it needs no wallet capability.
import { PluginCommand, type CommandIO } from '@metamask/agent-wallet/plugin'
import { CARDS, bookAbi, forPeople, live, marketFor, pub, ZERO } from '../../tivan.js'

type Row = { id: string; card: string; grade: number; market: string | null; bid: number | null; ask: number | null }

export default class TivanMarkets extends PluginCommand<{ markets: Row[] } | undefined> {
  static description = 'List Tivan graded-card markets on Kuru with their best bid and ask'
  protected readonly pluginCommandId = 'tivan:markets'

  async execute(io: CommandIO) {
    const client = pub()
    // Issued together so the client folds them into two multicalls instead of 38 separate requests.
    const found = await Promise.all(CARDS.map((c) => marketFor(client, c.spec, c.grade)))
    const books = await Promise.all(
      found.map(({ market }) => (market === ZERO ? null : client.readContract({ address: market, abi: bookAbi, functionName: 'bestBidAsk' }))),
    )
    const markets: Row[] = CARDS.map((c, i) => {
      const book = books[i]
      if (!book) return { id: c.id, card: c.name, grade: c.grade, market: null, bid: null, ask: null }
      const [bid, ask] = book
      return {
        id: c.id,
        card: c.name,
        grade: c.grade,
        market: found[i].market,
        bid: live(bid) ? Number(bid / 10n ** 16n) / 100 : null,
        ask: live(ask) ? Number(ask / 10n ** 16n) / 100 : null,
      }
    })
    const w = Math.max(...markets.map((m) => m.card.length))
    for (const m of markets) {
      const px = (v: number | null) => (v === null ? '—' : `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
      io.emit(`${m.id.padEnd(9)} PSA ${String(m.grade).padEnd(2)} ${m.card.padEnd(w)} bid ${px(m.bid).padStart(12)}  ask ${px(m.ask).padStart(12)}`)
    }
    return forPeople(io.flags) ? undefined : { markets }
  }
}
