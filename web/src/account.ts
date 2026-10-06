import { createPasskeyWithPrfOutput, createSecp256k1SigningSession, getPasskeyPrfOutput, isMeraError, type PasskeyCredentialMetadata } from '@category-labs/mera'
import { toViemAccount } from '@category-labs/mera/viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import type { LocalAccount } from 'viem'
import { net } from './config'

// Only public metadata is stored: which passkey to ask for. The key itself is re-derived from the passkey's PRF
// output on each sign-in and lives in memory for the session.
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
  return fromPrf(res.prfOutput)
}

export async function signIn(): Promise<LocalAccount> {
  const credential = savedPasskey()
  const res = await getPasskeyPrfOutput({ rpId: location.hostname, credential })
  if (!credential) localStorage.setItem(CRED, JSON.stringify({ credentialId: res.credentialId }))
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
  return privateKeyToAccount(key)
}

export function signOut() {
  localStorage.removeItem(CRED)
}

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
