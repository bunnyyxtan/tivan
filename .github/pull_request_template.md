## What changed

Describe the change and why it is needed.

## How it was verified

Tick what you ran, and delete the rows that do not apply.

- [ ] `cd web && npm run lint && npm run build && npm test`
- [ ] `cd attestor && npm test`
- [ ] `cd contracts && forge build && forge test --no-match-contract Mainnet --fork-url https://testnet-rpc.monad.xyz`
- [ ] `cd contracts && forge test --match-contract Mainnet --fork-url https://rpc.monad.xyz`
- [ ] `cd plugins/tivan && npm run type-check && npm test && npm run build`
- [ ] `cd cre/slab-attest && bun test`

## Notes for reviewers

Call out anything risky, contract changes, the attestor signing path, passkey
sessions, redemption order, or indexer schema changes that need a resync.

## Checklist

- [ ] No `.env`, private keys, RPC credentials or build output staged
- [ ] Testnet-only behaviour stays labelled as testnet, and mainnet still reads
      as vault-only with no order books
- [ ] The demo market maker is still described as mine, never as user traction
- [ ] UI work follows [BRAND.md](../BRAND.md)
- [ ] Addresses or verified runs updated in [docs/DEPLOYMENTS.md](../docs/DEPLOYMENTS.md)
