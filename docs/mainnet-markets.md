# Mainnet market listing

Kuru restricts `Router.deployProxy` to its owner on Monad mainnet, so the mainnet `SlabVault` lists each SKU token with
`market == 0x0`. Once Kuru deploys a USDC market for a token, anyone attaches it with `SlabVault.linkMarket(sku, market)`.
The vault accepts the market only if `Router.verifiedMarket` reports the SKU token as base and the vault's USDC as quote.
The four mainnet SKUs are DEMO tokens with no physical card behind them.

Market parameters (the same ones the testnet vault uses; dry-run on a mainnet fork in `contracts/test/SlabVault.mainnetFork.t.sol`):

| Param | Value |
|---|---|
| type | `0` (NO_NATIVE) |
| base | the SKU token below |
| quote | USDC `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
| sizePrecision | `1` (whole cards) |
| pricePrecision | `100` (cents) |
| tickSize | `1` |
| minSize | `1` |
| maxSize | `1000` |
| takerFeeBps / makerFeeBps | `0` / `0` |

| kuruAmmSpread | `30` |

| SKU | SKU id (`SlabVault.skuOf`) | Base token |
|---|---|---|
| DEMO PSA 10 Base Set Pikachu Red Cheeks | `0xa5d50f82a15a819238a33e2a19ad83e1db0d3b8b39935b937d9c5f45cdaa4223` | `0x2915644C75Eb81ee1739F53AdE196B49427a1fd3` |
| DEMO PSA 10 Base Set Charizard Holo | `0xe1eb2b2161a492c07c5a334e48012567cba93ec021043f53c1955516a3c5a841` | `0xa3107Db1fFE75a99edED9E74e58bbcA5b9741F04` |
| DEMO PSA 10 Topps Chrome LeBron James Rookie #111 | `0x2a547895bcccd304e22f889c423322fbe5282d724364f13c0ded2df1c0e722cb` | `0xEF2eF6173806E785B4e75f13feb96afbCb6aa96a` |
| DEMO PSA 9 Alpha Black Lotus | `0x8cebbd8cb0e263a4539f57a7b613c138400a2956a0055855df8c3fe08c2ef30c` | `0x90144e87B9eb04f2027d00A0C4e2A48f7D527754` |

One line per token, from the Router owner (Router `0xd651346d7c789536ebf06dc72aE3C8502cd695CC`):

```sh
R=0xd651346d7c789536ebf06dc72aE3C8502cd695CC; SIG="deployProxy(uint8,address,address,uint96,uint32,uint32,uint96,uint96,uint256,uint256,uint96)"; USDC=0x754704Bc059F8C67012fEd69BC8A327a5aafb603; RPC=https://rpc.monad.xyz
cast send $R "$SIG" 0 0x2915644C75Eb81ee1739F53AdE196B49427a1fd3 $USDC 1 100 1 1 1000 0 0 30 --rpc-url $RPC   # Pikachu PSA 10
cast send $R "$SIG" 0 0xa3107Db1fFE75a99edED9E74e58bbcA5b9741F04 $USDC 1 100 1 1 1000 0 0 30 --rpc-url $RPC   # Charizard PSA 10
cast send $R "$SIG" 0 0xEF2eF6173806E785B4e75f13feb96afbCb6aa96a $USDC 1 100 1 1 1000 0 0 30 --rpc-url $RPC   # LeBron PSA 10
cast send $R "$SIG" 0 0x90144e87B9eb04f2027d00A0C4e2A48f7D527754 $USDC 1 100 1 1 1000 0 0 30 --rpc-url $RPC   # Black Lotus PSA 9
```

(Add your usual signer flags, e.g. `--account` / `--ledger`. We simulated these with `cast call --from <Router owner>` against mainnet on 2026-10-05: each returns a new market address. From any other address they revert `Unauthorized`.)

Once a market exists, anyone can attach it to the vault. `SlabVault.linkMarket(sku, market)` is permissionless,
because it checks `Router.verifiedMarket(market)`: the base has to be that SKU's token and the quote has to be the
vault's USDC, or it reverts. For example:

```sh
cast send 0x5ad7d5e06df36415c6f3fA48299Bf92ed921859a "linkMarket(bytes32,address)" 0xa5d50f82a15a819238a33e2a19ad83e1db0d3b8b39935b937d9c5f45cdaa4223 <pikachu market> --rpc-url https://rpc.monad.xyz
```

