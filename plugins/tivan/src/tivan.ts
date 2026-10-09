// Shared chain access for the Tivan plugin: the same SlabVault -> Kuru market path the app and the maker bot use.
// Reads go through plain viem on the public RPC; only writes need the Agent Wallet executor.
import { createPublicClient, encodeAbiParameters, http, keccak256, parseAbi, type Address, type Hex, type PublicClient } from 'viem'
import { monadTestnet } from 'viem/chains'

export const VAULT: Address = '0x998a3116dc9AaDb98AF27B31BeC93441E1991a12'
export const CHAIN_ID = monadTestnet.id

export const vaultAbi = parseAbi(['function skuInfo(bytes32) view returns (address token, address market, uint256 vaulted)'])
export const bookAbi = parseAbi(['function bestBidAsk() view returns (uint256,uint256)', 'function addBuyOrder(uint32,uint96,bool)'])

// The 19 seeded testnet SKUs, same set as the app's `seedSkus`: SlabVault has no enumeration view and the app
// deliberately avoids scanning old logs, so the catalog is listed rather than discovered.
export const CARDS: { id: string; spec: bigint; grade: number; name: string }[] = [
  { id: 'CHZ10', spec: 4n, grade: 10, name: 'Base Set Charizard Holo' },
  { id: 'CHZ9', spec: 4n, grade: 9, name: 'Base Set Charizard Holo' },
  { id: 'PIKA10', spec: 58n, grade: 10, name: 'Base Set Pikachu Red Cheeks' },
  { id: 'LOTUS9', spec: 1993232n, grade: 9, name: 'Alpha Black Lotus' },
  { id: 'BLST9', spec: 2n, grade: 9, name: 'Base Set Blastoise Holo' },
  { id: 'VENU9', spec: 15n, grade: 9, name: 'Base Set Venusaur Holo' },
  { id: 'MEW29', spec: 10n, grade: 9, name: 'Base Set Mewtwo Holo' },
  { id: 'MOXS8', spec: 1993140n, grade: 8, name: 'Alpha Mox Sapphire' },
  { id: 'USEA9', spec: 1993180n, grade: 9, name: 'Alpha Underground Sea' },
  { id: 'BEWD9', spec: 2002001n, grade: 9, name: 'Blue-Eyes White Dragon' },
  { id: 'DKMG9', spec: 2002005n, grade: 9, name: 'Dark Magician' },
  { id: 'EXOD9', spec: 2002124n, grade: 9, name: 'Exodia the Forbidden One' },
  { id: 'WAGNER3', spec: 1909001n, grade: 3, name: 'T206 Honus Wagner' },
  { id: 'COBB4', spec: 1909002n, grade: 4, name: 'T206 Ty Cobb' },
  { id: 'MATHEW5', spec: 1909003n, grade: 5, name: 'T206 Christy Mathewson' },
  { id: 'CYYOUNG5', spec: 1911001n, grade: 5, name: 'T205 Cy Young' },
  { id: 'WJOHN4', spec: 1909004n, grade: 4, name: 'T206 Walter Johnson' },
  { id: 'SPEAKER5', spec: 1909005n, grade: 5, name: 'T206 Tris Speaker' },
  { id: 'RUTH336', spec: 1933002n, grade: 6, name: 'Goudey Sport Kings Babe Ruth' },
]

/** SlabVault.skuOf: keccak(abi.encode(specId, grade)). */
export const skuOf = (spec: bigint, grade: number): Hex =>
  keccak256(encodeAbiParameters([{ type: 'uint256' }, { type: 'uint8' }], [spec, grade]))

export const findCard = (id: string) => CARDS.find((c) => c.id.toLowerCase() === id.toLowerCase())

/** Kuru prices are whole cents in a uint32; sizes are whole cards. */
export const toCents = (dollars: number): number => {
  const cents = Math.round(dollars * 100)
  if (!Number.isFinite(cents) || cents <= 0 || cents > 0xffffffff) throw new Error(`price out of range: ${dollars}`)
  return cents
}

export const pub = (): PublicClient => createPublicClient({ chain: monadTestnet, transport: http() })

const DEAD = 2n ** 255n
/** Kuru returns a sentinel, not 0, when a side of the book is empty. */
export const live = (x: bigint) => x > 0n && x < DEAD

export const marketFor = async (client: PublicClient, spec: bigint, grade: number) => {
  const [token, market] = await client.readContract({ address: VAULT, abi: vaultAbi, functionName: 'skuInfo', args: [skuOf(spec, grade)] })
  return { token, market }
}

export const ZERO: Address = '0x0000000000000000000000000000000000000000'
