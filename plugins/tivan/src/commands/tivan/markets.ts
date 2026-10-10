// `mm tivan markets` — the live Kuru book for every graded card Tivan has listed.
// Pure chain reads, so it needs no wallet capability.
import { PluginCommand, type CommandIO } from '@metamask/agent-wallet/plugin'
import { bookAbi, forPeople, listMarkets, live, pub } from '../../tivan.js'

type Row = { id: string; card: string; grade: number; market: string | null; bid: number | null; ask: number | null }

export default class TivanMarkets extends PluginCommand<{ markets: Row[] } | undefined> {
  static description = 'List Tivan graded-card markets on Kuru with their best bid and ask'
  protected readonly pluginCommandId = 'tivan:markets'

  async execute(io: CommandIO) {
    const client = pub()
    // Discovered, not listed: the indexer names every book the vault has deployed, prices come from the books.
    const found = await listMarkets(client)
    // Issued together so the client folds them into one multicall instead of a request per book.
    const books = await Promise.all(
      found.map(({ market }) => (market ? client.readContract({ address: market, abi: bookAbi, functionName: 'bestBidAsk' }) : null)),
    )
    const markets: Row[] = found.map((c, i) => {
      const book = books[i]
      if (!book) return { ...c, bid: null, ask: null }
      const [bid, ask] = book
      return {
        ...c,
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
