// `mm tivan buy CHZ10 --price 4800` — rest a bid on a graded card's Kuru book, signed by the Agent Wallet.
// Cash must already sit in the Kuru MarginAccount (fund it in the Tivan app); this command only places the order.
import { Args, Flags } from '@oclif/core'
import { CommandError, PluginCommand, type CommandIO } from '@metamask/agent-wallet/plugin'
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
    if (live(ask) && BigInt(cents) * 10n ** 16n >= ask) {
      const askUsd = (Number(ask / 10n ** 16n) / 100).toFixed(2)
      throw new CommandError(
        'BID_CROSSES_ASK',
        `$${(cents / 100).toFixed(2)} is at or above the ask of $${askUsd}, so it would buy instead of resting`,
        `Orders are post-only. Bid below $${askUsd}, or buy at the ask in the Tivan app.`,
      )
    }

    const submit = await this.ctx.walletExecutor(io, this.pluginCommandId)
    const result = await submit(
      {
        kind: 'transaction',
        chainId: CHAIN_ID,
        transaction: { to: market, abi: bookAbi, functionName: 'addBuyOrder', args: [cents, BigInt(flags.size), true] },
      },
      { signal: io.signal },
    ).catch((e: unknown) => {
      // MetaMask's gas service answers 400 Invalid chainId for Monad testnet, before anything is signed.
      if (e instanceof Error && e.message.includes("Non-200 status code: '400'"))
        throw new CommandError(
          'CHAIN_NOT_RELAYED',
          `The Agent Wallet received the bid, and MetaMask's gas service declined Monad testnet (chain ${CHAIN_ID}) before signing`,
          'MetaMask lists Monad Testnet with relaySupported false. Check with: mm chains list',
          e,
        )
      throw e
    })
    if (result.kind !== 'transaction') throw new Error(`expected a transaction result, got ${result.kind}`)

    io.emit(`bid ${flags.size} x ${card.id} (PSA ${card.grade} ${card.name}) at $${(cents / 100).toFixed(2)} — ${result.hash}`)
    return { card: card.id, price: cents / 100, size: flags.size, market, hash: result.hash, status: result.status }
  }
}
