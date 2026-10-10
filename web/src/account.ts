import { createPasskeyWithPrfOutput, createSecp256k1SigningSession, getPasskeyPrfOutput, isMeraError, type PasskeyCredentialMetadata } from '@category-labs/mera'
import { toViemAccount } from '@category-labs/mera/viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { LocalAccount } from 'viem'
import { net } from './config'

// Stored in localStorage: only public metadata, which passkey to ask for. The key comes from the passkey's PRF output
// and is kept encrypted in IndexedDB between visits (see "staying signed in").
const CRED = 'slab.passkey'
const DEVICE_KEY = 'slab.deviceKey'

export const savedPasskey = (): PasskeyCredentialMetadata | undefined => {
  try {
    return JSON.parse(localStorage.getItem(CRED) ?? '') ?? undefined
  } catch {
    return undefined
  }
}
export const hasDeviceKey = () => {
  try {
    return !!localStorage.getItem(DEVICE_KEY)
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- the session
// One passkey ceremony opens a session on this device. Inside it, everyday trading signs with a Mera signing session and no
// prompt; withdrawals, redemptions, key export and large trades still ask for the passkey (see needsPasskey in tx.tsx).
// The session's key is kept between visits so a refresh does not ask again. It is encrypted with an AES key the browser
// creates as non-extractable and keeps in IndexedDB, so the raw key never sits in localStorage and a copied disk image or
// storage export cannot decrypt it. The session ends after SESSION_MS or when the person ends it; either way the kept key
// is deleted, and the passkey alone rebuilds the same account on any device.
const DB = 'tivan'
const STORE = 'session'
export const SESSION_MS = 7 * 24 * 3600 * 1000
type Saved = { kind: 'passkey' | 'device'; at: number; wrap?: CryptoKey; iv?: Uint8Array; data?: ArrayBuffer }

function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((ok, fail) => {
    const open = indexedDB.open(DB, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE)
    open.onerror = () => fail(open.error)
    open.onsuccess = () => {
      const req = fn(open.result.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => (ok(req.result as T), open.result.close())
      req.onerror = () => (fail(req.error), open.result.close())
    }
  })
}

async function keep(kind: Saved['kind'], secret?: Uint8Array) {
  try {
    const rec: Saved = { kind, at: Date.now() }
    if (secret) {
      rec.wrap = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
      rec.iv = crypto.getRandomValues(new Uint8Array(12))
      rec.data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: rec.iv as BufferSource }, rec.wrap, secret as BufferSource)
    }
    await idb('readwrite', (s) => s.put(rec, 'current'))
  } catch (e) {
    console.warn('could not keep the session on this device', e)
  }
}

/** When the session on this device ends, in milliseconds since the epoch, or undefined when there is none. */
export async function sessionEndsAt(): Promise<number | undefined> {
  try {
    const rec = await idb<Saved | undefined>('readonly', (s) => s.get('current'))
    return rec ? rec.at + SESSION_MS : undefined
  } catch {
    return undefined
  }
}

/** The account from the last visit while its session is open. `ended` says a session existed but ran out. */
export async function restoreSession(): Promise<{ account?: LocalAccount; ended: boolean; endsAt?: number }> {
  try {
    const rec = await idb<Saved | undefined>('readonly', (s) => s.get('current'))
    if (!rec) return { ended: false }
    const endsAt = rec.at + SESSION_MS
    if (Date.now() >= endsAt) return (await endSession(), { ended: true })
    const key = localStorage.getItem(DEVICE_KEY) as `0x${string}` | null
    if (rec.kind === 'device') return key ? { account: privateKeyToAccount(key), ended: false, endsAt } : { ended: false }
    if (!rec.wrap || !rec.iv || !rec.data) return { ended: false }
    const prf = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv as BufferSource }, rec.wrap, rec.data))
    return { account: fromPrf(prf), ended: false, endsAt }
  } catch (e) {
    console.warn('no kept session', e)
    return { ended: false }
  }
}

function fromPrf(prfOutput: Uint8Array): LocalAccount {
  // The PRF output is 32 bytes of authenticator-bound entropy; mera validates it as a secp256k1 scalar.
  const session = createSecp256k1SigningSession({ privateKey: prfOutput })
  prfOutput.fill(0)
  return toViemAccount(session)
}

export async function createAccount(name: string): Promise<LocalAccount> {
  const res = await createPasskeyWithPrfOutput({
    rp: { id: location.hostname, name: 'Tivan' },
    user: { name, displayName: name },
  })
  localStorage.setItem(CRED, JSON.stringify({ credentialId: res.credentialId, transports: res.transports }))
  await keep('passkey', res.prfOutput)
  return fromPrf(res.prfOutput)
}

// `pick` ignores the remembered passkey so the browser lists every passkey for this site.
export async function signIn(pick = false): Promise<LocalAccount> {
  const credential = pick ? undefined : savedPasskey()
  const res = await getPasskeyPrfOutput({ rpId: location.hostname, credential })
  if (!credential) localStorage.setItem(CRED, JSON.stringify({ credentialId: res.credentialId }))
  await keep('passkey', res.prfOutput)
  return fromPrf(res.prfOutput)
}

// NOTE: fallback for browsers/authenticators without WebAuthn PRF (some password managers, older Android).
// The key sits in localStorage, so it is only as safe as this browser profile. Limit: testnet demo only; on
// mainnet require PRF passkeys or mera's secret vault.
export function deviceAccount(): LocalAccount {
  if (net.name !== 'testnet') throw new Error('This device needs a passkey with PRF support to sign in.')
  let key = localStorage.getItem(DEVICE_KEY) as `0x${string}` | null
  if (!key) {
    key = generatePrivateKey()
    localStorage.setItem(DEVICE_KEY, key)
  }
  void keep('device')
  return privateKeyToAccount(key)
}

/**
 * Asks for the passkey again (Face ID, fingerprint, Windows Hello) right before money or a card moves, and checks it is
 * the passkey this account came from. The signing key stays in memory for the session, so this is a confirmation gate.
 * Device-key test accounts have no passkey and skip it.
 */
export async function confirmPasskey(expected: string) {
  const res = await getPasskeyPrfOutput({ rpId: location.hostname, credential: savedPasskey() })
  if (fromPrf(res.prfOutput).address.toLowerCase() !== expected.toLowerCase()) throw new Error('That passkey is not the one this account was created with.')
}
export const confirmStep = (a: LocalAccount): [string, () => Promise<void>][] => (a.source === 'mera' ? [['Confirming with your passkey', () => confirmPasskey(a.address)]] : [])

// Ending the session forgets the kept key. The public hint (which passkey to ask for) stays, so the next visit says
// "Continue with your passkey" and cannot start a second, empty account by accident.
export const endSession = () => idb('readwrite', (s) => s.delete('current')).catch(() => {})
export const signOut = endSession

/**
 * True only when this device's passkey provider cannot do PRF. That is the one case `deviceAccount` exists for, so the
 * fallback is never offered after a cancelled prompt: a passkey account must stay reconstructible from the passkey.
 */
export const prfUnavailable = (e: unknown) => isMeraError(e) && e.code === 'PRF_UNAVAILABLE'

export const friendlyError = (e: unknown): string => {
  if (isMeraError(e)) {
    if (e.code === 'PRF_UNAVAILABLE') return 'This device’s passkey provider can’t create a Slab account yet.'
    if (e.code === 'PASSKEY_OPERATION_FAILED') return 'Passkey request was cancelled or isn’t available here.'
  }
  const err = e as { shortMessage?: string; message?: string; details?: string }
  // Monad reserves gas_limit x fee up front; the RPC's reason is buried under viem's generic "invalid parameters".
  if (/insufficient balance|insufficient funds/i.test(`${err?.details} ${err?.message}`))
    return 'Not enough MON for network fees. Tap “Get test dollars” under Account to top up.'
  return err?.shortMessage ?? err?.message ?? String(e)
}
