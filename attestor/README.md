# Attestor relay

Tiny HTTP service (Node 22, tsx, viem) that signs SlabVault calls with the team key (`DEPLOYER_KEY`, which is both `attestor` and `custodian` on the testnet vault). It is the stand-in for the Chainlink CRE DON until a receiver contract is deployed (see `../cre/README.md`).

```sh
cd attestor && npm install && npm run dev      # :8787, NETWORK=testnet by default
NETWORK=mainnet npm start                      # mainnet: vault 0x5ad7…859a, USDC quote, Kuru router built in (MAINNET_VAULT overrides);
                                               # refuses to start without PSA_TOKEN and CUSTODY_TOKEN
```

Reads `../.env` (`DEPLOYER_KEY`, optional `PSA_TOKEN`, `CUSTODY_TOKEN`). Without `PSA_TOKEN` certs are checked against `../cre/fixtures/psa-certs.json` (demo certs only, testnet only). Transactions from the signer key are sent one at a time so concurrent requests don't collide on nonces.

| Endpoint | Body | Does |
|---|---|---|
| `POST /attest` | `{certId, specId, grade, holder, name, symbol}` | Looks the cert up (PSA API or fixtures), rejects if specId/grade don't match the registry, then `SlabVault.attest`. Returns `{txHash, sku, token, market, verifiedBy}`; on mainnet a new SKU's `market` is the zero address until Kuru deploys its book and someone calls `SlabVault.linkMarket`. |
| `POST /custody` | `{certId}` | `SlabVault.confirmCustody`: mints 1 token to the holder. **Demo button.** In production only the custodian calls this, after physically receiving and inspecting the slab; here it's open so judges can click through the flow. If `CUSTODY_TOKEN` is set (required on mainnet) the call needs a matching `x-custody-token` header. |
| `POST /drip` | `{address}` | Sends `DRIP_MON` (default 0.2) testnet MON for gas, only while the address holds under a quarter of that, at most once per 10 minutes per address and `DRIPS_PER_HOUR` (default 30) in total. Refused (503) when the signer would drop below `DRIP_RESERVE_MON` (default 0.3, enough to list a new market), and (403) on mainnet. |
| `GET /cert/:id` | | Read-only registry lookup `{specId, grade, subject}` (404 if unknown) so the app can pre-fill card and grade. `/attest` re-verifies. |
| `GET /health` | | network, chain id, vault, signer address |

Errors are `{error}` with 400 (bad input), 403, 422 (registry mismatch), 409 (still has enough MON), 429 (dripped in the last 10 minutes, or hourly cap reached), 503 (faucet low), 502 (revert, with the reason).

Behind an HTTPS proxy, start it with `NODE_USE_ENV_PROXY=1` so Node's fetch honours `HTTPS_PROXY`.
