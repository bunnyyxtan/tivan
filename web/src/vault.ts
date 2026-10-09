import { getPasskeyPrfOutput } from '@category-labs/mera'
import { bytesToHex, hexToBytes, parseAbi, type Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { savedPasskey } from './account'
import { post } from './attestor'
import { pub } from './chain'
import { net } from './config'

// The private vault: a second Mera PRF namespace that does no wallet work.
// The same passkey that opens the account is asked again under its own salt, `sha256("tivan.private-vault.v1")`, so its
// output is unrelated to the account key. HKDF splits that output into three keys, each for one job:
// - seal: an AES-256-GCM key that encrypts the vault;
// - locator: 32 bytes that say where the sealed box lives;
// - keeper: a secp256k1 key that signs each write, so only this passkey can replace the box. It is not the trading
//   account, so the box is not linked to the person's address on chain, and Tivan's relay can pay the gas.
// None of them is ever stored. Only ciphertext goes to SealedBox on Monad, so the same passkey on any device rebuilds all
// three and opens the same vault, and nobody else can read it.

const NAMESPACE = 'tivan.private-vault.v1'
const VERSION = 2
const boxAbi = parseAbi([
  'function boxOf(bytes32 locator) view returns (bytes)',
  'function nonceOf(bytes32 locator) view returns (uint256)',
  'function writeHash(bytes32 locator, bytes box, uint256 nonce) view returns (bytes32)',
])
const enc = new TextEncoder()

/** What the vault carries: the browser-local things that should follow you to any device, and your own notes. */
export type VaultData = { v: 2; watch: string[]; alerts: { sku: string; kind: string; price?: number }[]; notes: Record<string, string>; savedAt: number }
export const emptyVault = (): VaultData => ({ v: 2, watch: [], alerts: [], notes: {}, savedAt: 0 })

/** Keys for one visit: held in memory only, dropped when the vault is locked or the page closes. */
export type VaultKeys = { aes: CryptoKey; locator: Hex; keeper: Hex; keeperAddress: Hex }

export const vaultAvailable = () => !!net.sealedBox

/** One passkey ceremony under the vault's own salt, then HKDF into the seal key, the locator and the keeper key. */
export async function unlockKeys(): Promise<VaultKeys> {
  const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(NAMESPACE)))
  const { prfOutput } = await getPasskeyPrfOutput({ rpId: location.hostname, credential: savedPasskey(), prfSalt: salt })
  try {
    const ikm = await crypto.subtle.importKey('raw', prfOutput, 'HKDF', false, ['deriveKey', 'deriveBits'])
    const hk = (info: string) => ({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode(info) })
    const aes = await crypto.subtle.deriveKey(hk('tivan vault seal aes-256-gcm'), ikm, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    const locator = bytesToHex(new Uint8Array(await crypto.subtle.deriveBits(hk('tivan vault locator'), ikm, 256)))
    // NOTE: a 32-byte HKDF output is a valid secp256k1 scalar except with negligible probability; privateKeyToAccount checks.
    const keeper = bytesToHex(new Uint8Array(await crypto.subtle.deriveBits(hk('tivan vault keeper secp256k1'), ikm, 256)))
    return { aes, locator, keeper, keeperAddress: privateKeyToAccount(keeper).address }
  } finally {
    prfOutput.fill(0)
  }
}

/** The sealed box for these keys, decrypted, or undefined when nothing has been saved yet. */
export async function readVault(k: VaultKeys): Promise<{ data: VaultData; size: number } | undefined> {
  const box = await pub.readContract({ address: net.sealedBox!, abi: boxAbi, functionName: 'boxOf', args: [k.locator] })
  const bytes = hexToBytes(box)
  if (bytes.length === 0) return undefined
  if (bytes[0] > VERSION) throw new Error('This vault was sealed by a newer version of Tivan.')
  // The locator is bound in as associated data, so a box copied to another slot will not open.
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(1, 13) as BufferSource, additionalData: hexToBytes(k.locator) as BufferSource }, k.aes, bytes.slice(13) as BufferSource)
  return { data: JSON.parse(new TextDecoder().decode(plain)) as VaultData, size: bytes.length }
}

/** Seals the vault, signs the write with the keeper key, and has Tivan's relay submit it (the relay pays the gas). */
export async function saveVault(k: VaultKeys, data: VaultData) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: hexToBytes(k.locator) as BufferSource }, k.aes, enc.encode(JSON.stringify({ ...data, savedAt: Date.now() }))))
  const bytes = new Uint8Array(1 + iv.length + ct.length)
  bytes.set([VERSION], 0)
  bytes.set(iv, 1)
  bytes.set(ct, 13)
  const box = bytesToHex(bytes)
  const nonce = await pub.readContract({ address: net.sealedBox!, abi: boxAbi, functionName: 'nonceOf', args: [k.locator] })
  const hash = await pub.readContract({ address: net.sealedBox!, abi: boxAbi, functionName: 'writeHash', args: [k.locator, box, nonce] })
  const sig = await privateKeyToAccount(k.keeper).signMessage({ message: { raw: hash } })
  const r = (await post('/vault/put', { locator: k.locator, box, nonce: nonce.toString(), sig })) as { txHash: Hex }
  return { hash: r.txHash, size: bytes.length }
}

// The browser-local things the vault carries. Kept here so one place knows every key involved.
const WATCH = 'slab.watch'
const ALERTS = 'tivan.alerts'
const NOTES = 'tivan.notes'
const readJson = <T,>(k: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? '') ?? fallback
  } catch {
    return fallback
  }
}

/** What this browser holds right now. */
export const localData = (): VaultData => ({ v: 2, watch: readJson<string[]>(WATCH, []), alerts: readJson<VaultData['alerts']>(ALERTS, []), notes: readJson<Record<string, string>>(NOTES, {}), savedAt: 0 })

/** Put a decrypted vault onto this device, then tell the app to re-read it. */
export function applyVault(d: VaultData) {
  try {
    localStorage.setItem(WATCH, JSON.stringify(d.watch ?? []))
    localStorage.setItem(ALERTS, JSON.stringify(d.alerts ?? []))
    localStorage.setItem(NOTES, JSON.stringify(d.notes ?? {}))
  } catch {}
  dispatchEvent(new Event('tivan-alerts'))
  dispatchEvent(new Event('tivan-watch'))
}
