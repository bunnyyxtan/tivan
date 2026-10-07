import { readFileSync } from 'node:fs'
import { network, psaToken } from './config.ts'

// Same fixtures the CRE workflow uses, so both attestation paths agree.
const fixtures: Record<string, { PSACert: PsaCert }> = JSON.parse(
  readFileSync(new URL('../../cre/fixtures/psa-certs.json', import.meta.url), 'utf8'),
)

// NOTE: testnet-only restock certs, 9 + card index (1 digit) + serial (4 digits) padded: 90000000 + index * 10000 + serial.
// They let the demo market maker vault fresh copies of the five demo cards when one sells out. Mainnet requires PSA_TOKEN,
// so this branch can never run there.
const DEMO_CARDS: [spec: number, grade: number, subject: string][] = [
  [4, 10, 'CHARIZARD-HOLO'],
  [4, 9, 'CHARIZARD-HOLO'],
  [58, 10, 'PIKACHU'],
  [2003111, 10, 'LEBRON JAMES'],
  [1993232, 9, 'BLACK LOTUS'],
  [2, 9, 'BLASTOISE-HOLO'],
  [15, 9, 'VENUSAUR-HOLO'],
  [10, 9, 'MEWTWO-HOLO'],
  [1986057, 8, 'MICHAEL JORDAN'],
  [1996138, 10, 'KOBE BRYANT'],
  [1952311, 5, 'MICKEY MANTLE'],
  [2000144, 9, 'TOM BRADY'],
  [1979018, 8, 'WAYNE GRETZKY'],
  [2018700, 10, 'SHOHEI OHTANI'],
  [1993140, 8, 'MOX SAPPHIRE'],
  [1993180, 9, 'UNDERGROUND SEA'],
  [2002001, 9, 'BLUE-EYES WHITE DRAGON'],
  [2002005, 9, 'DARK MAGICIAN'],
  [2002124, 9, 'EXODIA THE FORBIDDEN ONE'],
  [1909001, 3, 'HONUS WAGNER'],
  [1909002, 4, 'TY COBB'],
  [1909003, 5, 'CHRISTY MATHEWSON'],
  [1911001, 5, 'CY YOUNG'],
  [1909004, 4, 'WALTER JOHNSON'],
  [1909005, 5, 'TRIS SPEAKER'],
  [1933002, 6, 'BABE RUTH'],
]
function demoCert(certId: bigint): PsaCert | undefined {
  if (network.name !== 'testnet' || certId < 90_000_000n || certId >= 90_000_000n + BigInt(DEMO_CARDS.length) * 10_000n) return undefined
  const [spec, grade, subject] = DEMO_CARDS[Number((certId - 90_000_000n) / 10_000n)]
  return { CertNumber: certId.toString(), SpecID: spec, CardGrade: `GEM MT ${grade}`, Subject: subject }
}

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
    cert = fixtures[certId.toString()]?.PSACert ?? demoCert(certId)
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
