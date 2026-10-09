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

// ---------------------------------------------------------------- staying signed in
// The signing key is kept on this device between visits so a refresh does not ask for the passkey again. It is encrypted
// with an AES key that the browser creates as non-extractable and keeps in IndexedDB: the raw key never sits in
// localStorage, and a copied disk image or storage export cannot decrypt it. Script running on this site could still use
// it, which is why moving money or cards still asks for the passkey (confirmStep). Signing out deletes it.
const DB = 'tivan'
const STORE = 'session'
const KEEP_MS = 30 * 24 * 3600 * 1000
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

/** The account from the last visit, when it is still kept on this device. */
export async function restoreSession(): Promise<LocalAccount | undefined> {
  try {
    const rec = await idb<Saved | undefined>('readonly', (s) => s.get('current'))
    if (!rec || Date.now() - rec.at > KEEP_MS) return undefined
    if (rec.kind === 'device') return hasDeviceKey() ? deviceAccount() : undefined
    if (!rec.wrap || !rec.iv || !rec.data) return undefined
    const key = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv as BufferSource }, rec.wrap, rec.data))
    return fromPrf(key)
  } catch (e) {
    console.warn('no kept session', e)
    return undefined
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

// Signing out forgets the kept key. The public hint (which passkey to ask for) stays, so the next visit says "Continue
// with your passkey" and cannot start a second, empty account by accident.
export const signOut = () => idb('readwrite', (s) => s.delete('current')).catch(() => {})

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
