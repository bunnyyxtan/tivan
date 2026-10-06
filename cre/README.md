# CRE workflow: verify a grade before any token exists

`slab-attest/` is a Chainlink CRE workflow (TypeScript SDK `@chainlink/cre-sdk` 1.23.0, CLI `cre` v1.37.0).

HTTP trigger `{certId, holder, name, symbol}` →
1. look the cert up in the grader registry (PSA `GetByCertNumber`), each DON node independently, `consensusIdenticalAggregation` over `{certId, specId, grade}`. The **specId and grade come from the registry, never from the caller**;
2. EVM read on Monad: `SlabVault.certs(certId)` must be unknown;
3. `runtime.report(...)`: a DON-signed report whose payload is exactly `abi.encode(certId, specId, grade, holder, name, symbol)`, the arguments of `SlabVault.attest`;
4. `EVMClient.writeReport` to a receiver contract (skipped when `receiver` is empty, see below).

Chain: `monad-testnet` (`project.yaml` → `https://testnet-rpc.monad.xyz`). Mainnet is the `mainnet-settings` target (`monad-mainnet`, SlabVault `0x5ad7d5e06df36415c6f3fA48299Bf92ed921859a`; quote token there is USDC).

## Registry source

- `config.testnet.json` → `usePsaApi: false`: certs come from `../fixtures/psa-certs.json` (demo certs shaped like PSA API responses; marked `NOTE:`). **We have no PSA API bearer token**, so the live path has not been called against PSA.
- `config.testnet-psa.json` / `config.mainnet.json` → `usePsaApi: true`: calls `https://api.psacard.com/publicapi/cert/GetByCertNumber/{cert}` with `authorization: bearer $PSA_TOKEN` (secret `PSA_TOKEN` ← env `PSA_TOKEN_VALUE`, `secrets.yaml`).

The attestor relay service (`../attestor`) reads the same fixtures file, so both paths agree.

## Run

```sh
cd cre/slab-attest && bun install
bun test                                   # handler on the SDK test runtime
cre workflow build ./ -T testnet-settings -R ..   # compile to WASM
cre login                                  # needed for simulate (browser) or export CRE_API_KEY
cre workflow simulate ./slab-attest -T testnet-settings --non-interactive \
  --trigger-index 0 --http-payload ./slab-attest/payload.json     # from cre/
```

## What actually ran (2026-10-05)

CLI installed from the official signed release (`install.sh` pinned to tag v1.37.0, GPG signature verified by the script); Bun 1.3.14.

| Command | Result |
|---|---|
| `tsc --noEmit` | clean |
| `cre workflow build ./ -T testnet-settings -R ..` | `✓ Workflow compiled successfully`, `Binary hash: 3ec5036b8b0f9540c693cf6674ec6ba462007534e6e0d7db6962a769355a830f`, `binary.wasm` 2.6 MB |
| `bun test` | `3 pass, 0 fail, 9 expect() calls`. Fixtures path builds the expected report; PSA path sends `bearer <token>`, takes grade 9 from the registry, writes through the receiver; unknown cert / already-attested cert / bad holder / bad symbol rejected |
| report payload for cert 81234569 as `SlabVault.attest` calldata, `cast call --from <attestor>` on Monad testnet | succeeds (`0x`); same call from any other address reverts `only attestor` |
| `cre workflow simulate ./slab-attest -T testnet-settings --non-interactive --trigger-index 0 --http-payload ./slab-attest/payload.json` | **did not run**: `✗ Authentication required: not logged in and no CRE_API_KEY set`. `cre login` is an interactive browser flow and this build box has no CRE account/API key. |

So: the workflow compiles to the WASM the DON runs, and its logic is tested on the SDK's own test runtime (capability mocks for HTTP and EVM). **`cre workflow simulate` against Monad testnet has not been run yet** — it needs someone with a CRE account to `cre login` (or set `CRE_API_KEY`) and run the command above; paste its output here.

## What does not run: production DON on Monad

- No deployed DON writes to Monad here. Today `SlabVault.attestor` is the team key, used by `attestor/` (a relay that applies the same fixtures/PSA check and sends `attest`). That relay is the stand-in for the DON.
- **Write path needs a receiver contract.** `writeReport` does not call arbitrary functions: the CRE forwarder calls `onReport(bytes metadata, bytes report)` on a receiver that implements `IReceiver` (+ ERC-165 `supportsInterface`). `SlabVault` doesn't, and its `attestor` is `immutable`. To go live:
  1. add a receiver (or make SlabVault itself the receiver) that requires `msg.sender == <CRE forwarder for monad-testnet/mainnet>`, checks the workflow owner/ID in `metadata`, decodes `report` as `(uint256,uint256,uint8,address,string,string)` and calls `attest(...)`;
  2. redeploy SlabVault with `attestor = receiver`;
  3. set `receiver` in the workflow config. With `receiver: ""` (current) the workflow builds and signs the report and logs `report payload 0x…` but skips the write.
- The HTTP trigger is `trigger({})` (any caller), fine for simulate; a deployed workflow must set `authorizedKeys`.
