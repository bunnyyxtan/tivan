# CRE workflow: verify a grade before any token exists

`slab-attest/` is a Chainlink CRE workflow (TypeScript SDK `@chainlink/cre-sdk` 1.23.0, CLI `cre` v1.37.0). It decides
the one fact a graded-card token depends on: the grade. The depositor never supplies it.

HTTP trigger `{certId, holder, name, symbol}` →
1. **External API with consensus.** Every node calls the grader registry over HTTP (`GetByCertNumber`, PSA's response
   shape) and parses `{certId, specId, grade}`; `consensusIdenticalAggregation` requires the nodes to agree exactly. The
   **specId and grade come from the registry, never from the caller**.
2. **Blockchain read.** EVM read on Monad: `SlabVault.certs(certId)` must be unknown.
3. **Signed report.** `runtime.report(...)`: a report whose payload is exactly
   `abi.encode(certId, specId, grade, holder, name, symbol)`, the arguments of `SlabVault.attest`.
4. **Blockchain write.** `EVMClient.writeReport` through the Keystone forwarder to
   [`GradeOracle`](../contracts/src/GradeOracle.sol) on Monad, which accepts reports only from the forwarder and records
   each verified grade once (`GradeVerified`).

What reads GradeOracle:
- the attestor relay (`../attestor`), which lists a cert in SlabVault using the CRE-verified grade when one exists;
- the Envio indexer (`GradeCheck` entities);
- the card page, which marks each certificate verified through Chainlink CRE.

## Networks and registry

| Target | Registry | Receiver |
|---|---|---|
| `testnet-settings` (`config.testnet.json`) | PSA-shaped **demo registry API** hosted by our attestor: `https://tivan-attestor.onrender.com/registry/psa/cert/{id}`, no token. We have no PSA API token, so the demo certs are not real PSA records. | GradeOracle `0x63cbb0c3200ea053c3d487b31f4f3aa0323db3a0` (Monad testnet) |
| `testnet-psa-settings` (`config.testnet-psa.json`) | PSA's own API with `authorization: bearer $PSA_TOKEN` (secret `PSA_TOKEN` ← env `PSA_TOKEN_VALUE`, `secrets.yaml`) | same |
| `mainnet-settings` (`config.mainnet.json`) | PSA's own API | not deployed on mainnet yet |

GradeOracle's forwarder is the CRE simulation forwarder for Monad testnet, `0xB9F79d863261869B234c481D1f9A7af84AeAd192`
(from the CRE forwarder directory). For a deployed workflow, the owner switches it to the production KeystoneForwarder
`0xF8344CFd5c43616a4366C34E3EEE75af79a74482` with `setForwarder`.

## Run

```sh
cd cre/slab-attest && bun install
bun test                                            # handler on the SDK test runtime
cd .. && cre workflow build ./slab-attest -T testnet-settings -R .
cre login                                           # browser sign-in, once
# CRE_ETH_PRIVATE_KEY = a funded Monad testnet key that pays for the broadcast write
cre workflow simulate ./slab-attest -T testnet-settings --non-interactive \
  --trigger-index 0 --http-payload ./slab-attest/payload.json --broadcast
```

**Windows with Smart App Control on.** The compiler shells out to an unsigned `javy.exe`, which Application
Control blocks, so `cre workflow build` and an unqualified `simulate` both fail with `uv_spawn` / `EUNKNOWN`.
Build the wasm on Linux instead with the `Build CRE wasm` GitHub Actions workflow, download the
`slab-attest-wasm` artifact to `slab-attest/binary.wasm`, and pass it with an **absolute** path (a relative one
is rejected):

```sh
cre workflow simulate ./slab-attest -T testnet-settings --non-interactive --trigger-index 0 \
  --http-payload ./slab-attest/payload.json --wasm C:\path\to\cre\slab-attest\binary.wasm --broadcast
```

## What ran (2026-10-09, Windows, CRE CLI v1.37.0 from the official release, SHA-256 checked; Bun 1.4.2)

| Step | Result |
|---|---|
| `bun test` | 4 pass, 0 fail: fixtures path; PSA API with a bearer token through a receiver; the testnet demo registry API over HTTP with no token, writing to GradeOracle; unknown cert, already-attested cert, bad holder and bad symbol rejected |
| `cre workflow build ./slab-attest -T testnet-settings -R .` | `✓ Workflow compiled successfully` |
| GradeOracle deployed on Monad testnet | `0x63cbb0c3200ea053c3d487b31f4f3aa0323db3a0`, tx `0xa3b6e4c6536e035ddcc28b66041523c7e530905d9bb127062a6266af07c78642` |
| Demo registry API (attestor, local run) | known cert returns the PSA-shaped record; unknown cert returns 404 |
| `cre workflow supported-chains` | `monad-testnet` listed, simulation forwarder `0xB9F79d863261869B234c481D1f9A7af84AeAd192` |
| `cre workflow simulate ./slab-attest -T testnet-settings --non-interactive --trigger-index 0 --http-payload ./slab-attest/payload.json --broadcast` | `verified cert 81234569: spec 4 grade 10 (registry API https://tivan-attestor.onrender.com/registry/psa/cert/)`, then `attest report written: 0x33464a6267c4716a20f973b297c2949d8a86f15a974dbc676943b96401ed8dd3`. Simulation result `written: true`. |
| The write on Monad testnet | tx `0x33464a62…8dd3` succeeded in block 69517349, sent to the simulation forwarder, which called GradeOracle. `GradeVerified(certId 81234569, specId 4, grade 10, holder 0x9037…7911, "PSA 10 Base Set Charizard Holo", "CHZ10")`; `grades(81234569)` now returns spec 4, grade 10 |
| The attestor lists the cert from the CRE record | `POST /attest` on the live attestor returned `"verifiedBy":"chainlink-cre"`, SlabVault.attest tx `0x7c8de09c2817f7d0483859c64236d6c7904545de7af15bd73624bac3d8bfc18a` |

## Recorded run (2026-10-10, demo video)

Video: https://youtu.be/KSa6NWY8uYc. Smart App Control was enforced on the recording machine, so the wasm came from the
`Build CRE wasm` workflow and was passed with `--wasm`. The payload is [`slab-attest/payload.json`](slab-attest/payload.json)
and the relay call body is [`attest.json`](attest.json), cert 90049997, a testnet restock cert for Alpha Black Lotus PSA 9.

| Step | Result |
|---|---|
| `cre workflow simulate ./slab-attest -T testnet-settings --non-interactive --trigger-index 0 --http-payload ./slab-attest/payload.json --wasm <abs>\slab-attest\binary.wasm --broadcast` | `verified cert 90049997: spec 1993232 grade 9`, report written in tx `0x93020b5601d6d5fbb2318e8cf0c5a9fe4486038b68c6995f5569d4bf510985f4` (block 69802995); GradeOracle emitted `GradeVerified` and the forwarder's `ReportProcessed` has `result: true` |
| `curl.exe -s -X POST https://tivan-attestor.onrender.com/attest -H "content-type: application/json" -d "@attest.json"` | `"verifiedBy":"chainlink-cre"`, SlabVault.attest tx `0xacedb4dd2b47413d7390e3f5e9909c25750cf7783746db410786d9e2c43cae12` |

Each cert can be written once. A second simulate for the same cert makes the forwarder report `result: false`, and a
second attest reverts with `cert known`; use a fresh cert from 90040000 to 90049999 for another run.

GradeOracle is verified on Sourcify (runtime match, optimizer on, 200 runs).

## Limits

- The HTTP trigger is `trigger({})` (any caller), fine for simulation; a deployed workflow must set `authorizedKeys`.
- GradeOracle trusts its forwarder; with the production forwarder it should also pin the workflow ID and owner from
  `metadata`.
- SlabVault's `attestor` is immutable, so the relay still sends `attest`. A future vault can name GradeOracle (or a
  receiver that calls `attest`) as its attestor, which removes the relay from the trust path.
