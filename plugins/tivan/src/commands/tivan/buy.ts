// `mm tivan buy CHZ10 --price 4800` — rest a bid on a graded card's Kuru book, signed by the Agent Wallet.
// Cash must already sit in the Kuru MarginAccount (fund it in the Tivan app); this command only places the order.
import { Args, Flags } from '@oclif/core'
import { PluginCommand, type CommandIO } from '@metamask/agent-wallet/plugin'
import type { Address } from 'viem'
import { CHAIN_ID, bookAbi, findCard, live, marketFor, pub, toCents, ZERO } from '../../tivan.js'

type Result = { card: string; price: number; size: number; market: Address; hash: string; status: string }

export default class TivanBuy extends PluginCommand<Result> {
  static description = 'Place a bid on a Tivan graded-card market (Kuru order book on Monad)'
  static args = { card: Args.string({ required: true, description: 'Card id, e.g. CHZ10 (see `mm tivan markets`)' }) }
  static flags = {
    price: Flags.string({ required: true, description: 'Limit price in dollars per card, e.g. 4800' }),
    size: Flags.integer({ default: 1, description: 'Number of cards (whole cards only)' }),
  }
  static requiresAuth = true
  protected readonly pluginCommandId = 'tivan:buy'

  async execute(io: CommandIO): Promise<Result> {
    const { args, flags } = await this.parse(TivanBuy)
    const card = findCard(args.card)
    if (!card) throw new Error(`unknown card "${args.card}" — run \`mm tivan markets\` for the list`)
    if (flags.size < 1) throw new Error('size must be at least 1 whole card')
    const cents = toCents(Number(flags.price))

    const { market } = await marketFor(pub(), card.spec, card.grade)
    if (market === ZERO) throw new Error(`${card.id} has no market yet`)
    // Orders are post-only, so the agent can rest a bid but never take the ask. Kuru reverts a crossing one with
    // PostOnlyError; catch it here, before the wallet prompts, with the price that would have worked.
    const [, ask] = await pub().readContract({ address: market, abi: bookAbi, functionName: 'bestBidAsk' })
    if (live(ask) && BigInt(cents) * 10n ** 16n >= ask)
      throw new Error(`$${(cents / 100).toFixed(2)} is at or above the ask of $${(Number(ask) / 1e18).toFixed(2)}; this command only rests bids, so bid below the ask`)

    const submit = await this.ctx.walletExecutor(io, this.pluginCommandId)
    const result = await submit(
      {
        kind: 'transaction',
        chainId: CHAIN_ID,
        transaction: { to: market, abi: bookAbi, functionName: 'addBuyOrder', args: [cents, BigInt(flags.size), true] },
      },
      { signal: io.signal },
    )
    if (result.kind !== 'transaction') throw new Error(`expected a transaction result, got ${result.kind}`)

    io.emit(`bid ${flags.size} x ${card.id} (PSA ${card.grade} ${card.name}) at $${(cents / 100).toFixed(2)} — ${result.hash}`)
    return { card: card.id, price: cents / 100, size: flags.size, market, hash: result.hash, status: result.status }
  }
}
