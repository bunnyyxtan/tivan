import { readFileSync } from 'node:fs'
import { psaToken } from './config.ts'

// Same fixtures the CRE workflow uses, so both attestation paths agree.
const fixtures: Record<string, { PSACert: PsaCert }> = JSON.parse(
  readFileSync(new URL('../../cre/fixtures/psa-certs.json', import.meta.url), 'utf8'),
)

type PsaCert = { CertNumber: string; SpecID: number; CardGrade: string; Subject?: string }
export type Verified = { certId: bigint; specId: bigint; grade: number; subject: string; source: 'psa-api' | 'fixtures' }

/** Look the cert up in the grader registry. Returns null if PSA doesn't know it. */
export async function verifyCert(certId: bigint): Promise<Verified | null> {
  let cert: PsaCert | undefined
  let source: Verified['source']
  if (psaToken) {
    const res = await fetch(`https://api.psacard.com/publicapi/cert/GetByCertNumber/${certId}`, {
      headers: { authorization: `bearer ${psaToken}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`PSA API ${res.status}`)
    cert = ((await res.json()) as { PSACert?: PsaCert }).PSACert
    source = 'psa-api'
  } else {
    // NOTE: no PSA bearer token in the demo env, so certs come from a local fixtures file. Limit: only the
    // listed demo certs can be attested; set PSA_TOKEN to use the live registry.
    cert = fixtures[certId.toString()]?.PSACert
    source = 'fixtures'
  }
  if (!cert || String(cert.CertNumber) !== certId.toString()) return null
  // PSA grades look like "GEM MT 10" / "MINT 9"; take the trailing integer.
  // NOTE: half grades ("NM-MT 8.5") and qualifiers are rejected, since the vault's grade is a uint8.
  const m = /(?:^|\s)(\d{1,2})$/.exec(cert.CardGrade.trim())
  const grade = m ? Number(m[1]) : NaN
  if (!(grade >= 1 && grade <= 10) || !Number.isSafeInteger(cert.SpecID) || cert.SpecID <= 0) return null
  return { certId, specId: BigInt(cert.SpecID), grade, subject: cert.Subject ?? '', source }
}
