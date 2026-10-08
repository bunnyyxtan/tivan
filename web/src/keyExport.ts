import { getPasskeyPrfOutput } from '@category-labs/mera'
import type { LocalAccount } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { savedPasskey } from './account'

// Exporting the private key. This account is an ordinary key pair whose private key is the passkey's PRF output, so it can be
// shown, but only after the passkey is checked again, only as a private key (this wallet has no seed phrase), and only in memory:
// nothing here logs it, stores it or sends it anywhere. The caller zeroes the bytes as soon as the key is hidden.

const hex = (b: Uint8Array) => '0x' + [...b].map((x) => x.toString(16).padStart(2, '0')).join('')

/** Asks for the passkey again and returns the 32 key bytes. Throws if the key does not belong to this account. */
export async function exportKeyBytes(account: LocalAccount): Promise<Uint8Array> {
  let bytes: Uint8Array
  if (account.source === 'mera') {
    const res = await getPasskeyPrfOutput({ rpId: location.hostname, credential: savedPasskey() })
    bytes = new Uint8Array(res.prfOutput)
    res.prfOutput.fill(0)
  } else {
    // The testnet test account keeps its key in this browser; there is no passkey to ask.
    const k = localStorage.getItem('slab.deviceKey')
    if (!k) throw new Error('No key on this device')
    bytes = Uint8Array.from((k.slice(2).match(/.{2}/g) ?? []).map((x) => parseInt(x, 16)))
  }
  if (privateKeyToAccount(hex(bytes) as `0x${string}`).address !== account.address) {
    bytes.fill(0)
    throw new Error('KEY_MISMATCH')
  }
  return bytes
}

/** The key as text, for the moment it is shown or copied. */
export const keyText = (b: Uint8Array) => hex(b)
