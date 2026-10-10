// `mm tivan orders <address>` — the resting orders an address still has on Tivan's Kuru books.
// Reads Tivan's Envio indexer for the orders it created, then confirms each is still on the book on chain.
// Pure reads, so it needs no wallet capability.
import { Args } from '@oclif/core'
import { PluginCommand, type CommandIO } from '@metamask/agent-wallet/plugin'
import { type Address } from 'viem'
import { CARDS, indexedMarkets, indexedOrders, orderAbi, pub } from '../../tivan.js'

type Row = { card: string; id: string; side: 'bid' | 'ask'; price: number; size: number; orderId: string }

export default class TivanOrders extends PluginCommand<{ orders: Row[] }> {
  static description = 'Show the orders an address still has resting on Tivan markets'
  static args = { address: Args.string({ required: true, description: 'The account to look up, 0x…' }) }
  protected readonly pluginCommandId = 'tivan:orders'

  async execute(io: CommandIO) {
    const { args } = await this.parse(TivanOrders)
    const owner = args.address
    const client = pub()

    // Names come from the indexer, which knows every book the vault has deployed, not just the curated card list.
    const names = new Map((await indexedMarkets()).map((m) => [m.id.toLowerCase(), m.name]))

    const orders: Row[] = []
    for (const o of await indexedOrders(owner)) {
      const name = names.get(o.market.toLowerCase()) ?? o.market
      const id = CARDS.find((c) => name === `PSA ${c.grade} ${c.name}`)?.id ?? '-'
      // Kuru keeps the slot after a fill or a cancel, so size 0 or another owner means this one is gone.
      const [onChainOwner, size] = await client.readContract({
        address: o.market as Address,
        abi: orderAbi,
        functionName: 's_orders',
        args: [Number(o.orderId)],
      })
      if (size === 0n || onChainOwner.toLowerCase() !== owner.toLowerCase()) continue
      orders.push({ card: name, id, side: o.isBuy ? 'bid' : 'ask', price: Number(o.priceCents) / 100, size: Number(size), orderId: o.orderId })
    }

    if (orders.length === 0) io.emit(`no resting orders for ${owner}`)
    for (const o of orders) {
      const px = `$${o.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
      io.emit(`${o.id.padEnd(9)} ${o.side.padEnd(3)} ${String(o.size).padStart(2)} x ${px.padStart(12)}  ${o.card}  (order ${o.orderId})`)
    }
    return { orders }
  }
}
