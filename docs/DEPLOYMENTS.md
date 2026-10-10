# Deployments

## Monad testnet (chain 10143)

| Contract | Address |
|---|---|
| SlabVault | `0x998a3116dc9AaDb98AF27B31BeC93441E1991a12` |
| TestUSD (testnet stand-in for USDC) | `0x8C43e58dFAcF7Ee589b45EB7d0C61559F7413578` |
| SlabToken: PSA 10 Base Set Charizard Holo | `0xbe11cB16ea59C3B1ff829Aa1C4C494b0d965aEa8` |
| Kuru market for that SKU (deployed by SlabVault) | `0x21E6D98767bbFc5FC13aFA80c67d87e34f3d6648` |
| GradeOracle (Chainlink CRE receiver; simulation forwarder `0xB9F79d863261869B234c481D1f9A7af84AeAd192`) | `0x63cbb0c3200ea053c3d487b31f4f3aa0323db3a0` (tx `0xa3b6e4c6536e035ddcc28b66041523c7e530905d9bb127062a6266af07c78642`, block 69504015), source verified on [Sourcify](https://repo.sourcify.dev/10143/0x63cbb0c3200ea053c3d487b31f4f3aa0323db3a0) |
| SealedBox (private-vault ciphertext, keeper-signed writes) | `0x6f2e62cb9fd52c23348d8a26140cb6eb2aaf61b9` (tx `0x6e070572934744390613e81a94f5efaadc49b88ef8de2bb4ea6a8bca0303ad80`) |

End-to-end run (cert 81234567):

| Step | Tx |
|---|---|
| Attest grade, list SKU, deploy Kuru market | `0xbb1a34738cfa1383dff15a7445361fc735d90c9e911dfa6c4e961d0033a6ba95` |
| Confirm custody, mint 1 token | `0x9394ba26fa887d6ca3dc2121a06fe3a6fd46466236dfc136ef8cc6be12c17786` |
| Seller lists 1 card at $420.00 | `0x251efbbf1c6ac84a26e6614279a52bcc02d36324ded1335ff1ef5d849c9b0fcf` |
| Buyer market-buys it | `0x1b506888437760edaa818806f403b745d9358fbcdc6c3120eeacb373ad3eb511` |
| Buyer redeems the physical card | `0x7be32e3dcaae3524ad26e385871664d76e8792ccf838625595678b97db36888a` |

## App-driven run (2026-10-05, Monad testnet)

The web app was driven as two real users in headless Chromium, each signed in with a passkey through a virtual
WebAuthn authenticator with PRF (Mera): a seller `0xFc447926d4fB10ef62E24C92086Df15A8cEfA7Ac` and a buyer
`0x8a23A1155f16bEA7F7ea6771C43380D1c16A7f2a`. The attestor ran on :8787 and the Envio indexer was served through
Hasura. A market-maker account (`BUYER_ADDR`, driven with `cast`) seeded the second level of each book.

New SKUs, each with its own Kuru market (deployed by `SlabVault.attest`):

| SKU | Category | SlabToken | Kuru market |
|---|---|---|---|
| PSA 10 Base Set Pikachu Red Cheeks (spec 58) | Pokémon | `0x2f440Ef98565e436EE6833B05167970176514AE2` | `0xc3e49f03C4d00CA1Dc7308C65dcFF7BAbe63E87c` |
| PSA 10 Topps Chrome LeBron James Rookie #111 (spec 2003111) | Sports | `0x7027B0c603213741bc1735f6f70697d63f3038F6` | `0x464A6aa283bDBaBa71d8F23DAff82D62ba277BCe` |
| PSA 9 Alpha Black Lotus (spec 1993232) | Magic | `0x09f57b85a904D9ED126Fb67d94D3892338Bf852a` | `0x50a8174F78e8E50FDcd8Fd1d579CD1a88D24DEF8` |

Spec ids and certs 81234573-81234579 are demo fixtures (`cre/fixtures/psa-certs.json`), not real PSA records.

Seller (in the app):

| Step | Tx |
|---|---|
| Faucet drip (0.2 MON) | `0x6f43f010fe03329e998d668e26f2063be5583416a0efc03abfa52b162441ff36` |
| Mint $10,000 TestUSD | `0xc12c916e7f17ceb57f86232967b6f93e2c313cc9ae6ac9961f28d65bce02dbde` |
| Vault cert 81234571 (Pikachu): attest, lists SKU, deploys market | `0x467afe72e11de526f94813ce61e010d1b210a6520e521dda4e1f382f57c13743` |
| Vault cert 81234571: custody, mint 1 card | `0x24e0d89491d91691cde60a2d8c060d166a88127cb86217bb1c0d8ef9543ea2c9` |
| Vault cert 81234574 (LeBron): attest + market | `0xc7e92e7a44a0c3d4aaeed3055e614b80522b7cc67915b2ea060506903f18be6d` |
| Vault cert 81234574: custody | `0x4ed909132ad9307f280125220426ac7d437c016d66f7c7143efde31c89d635f2` |
| Vault cert 81234576 (Black Lotus): attest + market | `0xada2add7ddd93ed5096a3b35a5838e3a0c4da6e2d2d6d458196e4be9d058c030` |
| Vault cert 81234576: custody | `0xf7a56e90ce2fb31b2f0b0a784d1ba38dcdb0e74b2b4a2a8ed469b53b5add3fe8` |
| List Pikachu at $1,450 (`addSellOrder`) | `0xfea3caa2d59bf9a905d96d9f64e972550186514ede96cb5760efb814ee6299fb` |
| List LeBron at $18,500 | `0xd114f4cbe4fbea0c0c7b41173ba1adf225a15dfcc12f1931d00d3899aa539adb` |
| List Black Lotus at $525,000 | `0xeef56a3a9856e1b1c2b2a33de81751a3be404729524d8394fe5d4735ec2455ce` |
| Withdraw $1,450 sale proceeds from the exchange | `0x8fe9147b843213204ca90e8ad0086aacb49af8232a2d497b875726fa20613fb8` |
| Cancel the Black Lotus listing | `0xd717967266d7d4ba95a5b831d716ef48a73930cbf309c21ec239f527ff9451c1` |
| Re-list Black Lotus at $515,000 (reuses the card freed on the exchange, no deposit) | `0x906b0f1222623190d6db317c4c0fdb6d83874a1ca06ea43fb4e61aabde4740b9` |

Buyer (in the app):

| Step | Tx |
|---|---|
| Faucet drip | `0x1140f15fa6635f968dd5137ce57a41c2f8210e0a08bb71692caf76d8e71ef8d8` |
| Mint $10,000 TestUSD | `0x9c6e0aa9803a156f91f967ba3fcbe17b70aa2398c7be728e7d8b322c34c8fb57` |
| Approve, then buy 1 Pikachu at $1,450 (from the seller) | `0x0b8fcdaddc4934d3b8afd567b382fcc05f8d48c8a34f3e28612fc0aedb0fc182`, `0x2a6460e1253945f2c065bcf497f9fe35b2cc39f8422697154a9efc8834968998` |
| Approve, then buy 1 Pikachu at $1,650 (from the market maker) | `0x579927a4396691ef8e5fe806e4d075f668dcf872d034dab5e30f4a430ba9dbc5`, `0x1955f5bb091c53b65328e4a773243acfb90edc4b8c6d9b4f588ef3aad69397f6` |
| Redeem 1 Pikachu: returns cert 81234571 (oldest first) | `0x691eaa38fb83b285c64018c2f191ef0c8b980f5fe53dd472e1ad655cfda7f88b` |
| Bid $1,300 on Pikachu (approve, deposit, `addBuyOrder`) | `0x47b6fbb69c294fcd2413556fef8f2e26725b0805bef3923fed65c7e3a70d749f`, `0x2876f2e1d9779478b09b1b93d9ec6c7d1f22080ace2c1fd0c7ccf41a8bad15da`, `0x22e434b10329fd0f03869c7641b6024a9b44bfe16c574480de33eb5fd6359b5c` |
| Faucet top-up after running low on MON | `0xc83cbf5d02772b67e70095d0944aca4b705c7a1a5e249701509a300bb5499ea0` |
| Bid $16,500 on LeBron (cash already on the exchange, so one tx) | `0x95e1bfdb63af6b47b01d4f5e81ac7555aee26bb4fe330aa4f733dade05cffc8a` |

Market maker seeding (`cast`, `BUYER_ADDR`): certs 81234573 / 81234575 / 81234577 vaulted through the attestor API
(attest `0x40f7247b169bd93b9512c59803eff2da3185cdb3ed2ebab27aefdb933980a953`,
`0xad40334bbc4972ea4036760bdb802e94e57f6d7c9f31d04111b6c4590a76bf05`,
`0x67581c75081e356d124a4ed489a483880634d4630c7f56b1e2a99c39c1208ed9`), then asks and bids:

| Market | Ask | Bid |
|---|---|---|
| Pikachu PSA 10 | $1,650 `0x2b3b987d26473c744712f23bbc3753c0de59cd31e7f6f0520d3edf2e447153d8` (filled by the buyer) | $1,250 `0xd883ad8a008eb783839089c8b58fa1d2b5dc38ab4a9175dc5caa4bc86a9804f1` |
| LeBron PSA 10 | $19,900 `0x8512e3294ea6d9b4e03c98691d894fd43ecbcb310cb6376fca35f94e7e96aec5` | $16,000 `0x798fe5a7c556cc44c88067740125a88643eecd4e3238957e06ce2df99d37769c` |
| Black Lotus PSA 9 | $540,000 `0x1e17090d9f473260a405821946d009ca0d92412763d1fd989d7c12b5df380075` | $480,000 `0x1aa6f45b6984bdf70be9e372ee2b7ce458ac7783106abcd60819002bfd3a20f5` |
| Charizard PSA 10 | $5,200 `0x5e754ba642aa85f534cff46c0c8a24bde67588314cb66d2bab0d33fac44b9ab7` | $4,400 `0x48b015b1416f6bee119e5cb03c6361d83cf18d7e63aa75cfc2dcd30272b33eb9` |

Book state left for the demo: every market is two-sided except Pikachu, whose asks were bought out (bids at $1,300
and $1,250). Fixture certs still unused: 81234569 (Charizard PSA 10), 81234572 (Jordan PSA 8), 81234578 (LeBron),
81234579 (Black Lotus).

## Passkey account runs (2026-10-09, Monad testnet)

Driven in headless Edge with a virtual WebAuthn authenticator that supports PRF (Mera), against the app and a local
attestor:

| Check | Result |
|---|---|
| Landing page to a confirmed Monad transaction (new visitor, $10,000 test dollars) | 4 taps, 1 passkey ceremony, about 6 s in total, 0.8 s to settle |
| Buy for $475.16 inside the session | 0 passkey prompts, settled in 0.7 s, matched on the Kuru book |
| Buy for $1,545 (over the $1,000 session limit) | 1 passkey prompt, settled in 0.9 s |
| Private vault: seal the watchlist, alerts and notes | 225 bytes of ciphertext written to SealedBox by the relay, with no MON in the account |
| Stateless test: wipe all site storage, sign in with the same passkey | same address; the vault reopens and decrypts the same data from chain |
| Buy, list at $9,999, move the ask to $8,888, sell the listed card | each step reviewed and settled; the card page's orders panel updated at once |
| Price chart | tooltip on all 6 hover positions, no flicker; a pinned tooltip opens the trade on the explorer |

## Monad mainnet (chain 143)

RPC `https://rpc.monad.xyz`.

| Contract | Address |
|---|---|
| SlabVault | `0x5ad7d5e06df36415c6f3fA48299Bf92ed921859a` |
| Deploy tx | `0x7d0818e1c02ee19fc86e4c6835e3139877280b2f6614b736c64b89c107aeb689` (block 110839553) |
| Quote token: USDC (6 decimals) | `0x754704Bc059F8C67012fEd69BC8A327a5aafb603` |
| Kuru Router | `0xd651346d7c789536ebf06dc72aE3C8502cd695CC` |
| Superseded first vault (unused, deployed before the `linkMarket` fix) | `0x3978c0B9A8816654166290204582D72fE3f9b129` |

`attestor` = `custodian` = the deployer key (`MAINNET_DEPLOYER_ADDR` in `.env`). USDC, not AUSD: Kuru's official
MON-AUSD book is empty while MON-USDC is liquid.

**No mainnet markets.** Kuru told us on 10 October 2026 that they do not deploy markets on Monad mainnet for security
reasons, and offered testnet support instead, so this vault stays a deploy-path record and nothing trades on it. The
mechanism, for the record: Kuru mainnet market deployment is owner-gated, `Router.deployProxy` reverts
`Unauthorized` (`0x82b42900`) for anyone but Kuru's owner (on testnet it is permissionless). `SlabVault._list` therefore
try/catches `deployProxy`, so each new SKU gets its `SlabToken` with `market == 0x0`. Once Kuru deploys a USDC market for
a SKU token, anyone calls `SlabVault.linkMarket(sku, market)`; it checks `Router.verifiedMarket(market)` (base = the SKU
token, quote = the vault's USDC) and emits `MarketLinked(sku, market)`. The parameters we would have used are in
[mainnet-markets.md](mainnet-markets.md).

**DEMO SKUs.** Four SKUs, 1 token each, held by the deployer. There are **no physical cards** behind them: every token
name starts with "DEMO", and the web app labels them as demo listings.

| Cert | Spec / grade | Token name | SKU id (`skuOf`) | SlabToken | Attest tx | Custody tx |
|---|---|---|---|---|---|---|
| 900000001 | 58 / 10 | DEMO PSA 10 Base Set Pikachu Red Cheeks | `0xa5d50f82a15a819238a33e2a19ad83e1db0d3b8b39935b937d9c5f45cdaa4223` | `0x2915644C75Eb81ee1739F53AdE196B49427a1fd3` | `0xbb81cb00c6255ce13cadc282197de328cafafa820a50f427e6071e4b2bc5ba22` | `0xa17498be9a2be7e5ce8c9002d60fde5e35945a4ff29a1e08c861e4cd6dce940b` |
| 900000002 | 4 / 10 | DEMO PSA 10 Base Set Charizard Holo | `0xe1eb2b2161a492c07c5a334e48012567cba93ec021043f53c1955516a3c5a841` | `0xa3107Db1fFE75a99edED9E74e58bbcA5b9741F04` | `0xfdc477792cd9608820c3ce6aec38eb967fb8d86cf318c294161568e3562ff14f` | `0xe53075e6dc0cba5c32ff2c60da161cc078a508e3947309b2ef6bef445061e15b` |
| 900000003 | 2003111 / 10 | DEMO PSA 10 Topps Chrome LeBron James Rookie #111 | `0x2a547895bcccd304e22f889c423322fbe5282d724364f13c0ded2df1c0e722cb` | `0xEF2eF6173806E785B4e75f13feb96afbCb6aa96a` | `0xbe04c77767377129014d9e626b5489769595e3fae12fc18bc06cea5839e227d6` | `0x94786a0e1182242c33c339bb5400baab031ad811666c39200e62eb4ec5e2a3c6` |
| 900000004 | 1993232 / 9 | DEMO PSA 9 Alpha Black Lotus | `0x8cebbd8cb0e263a4539f57a7b613c138400a2956a0055855df8c3fe08c2ef30c` | `0x90144e87B9eb04f2027d00A0C4e2A48f7D527754` | `0x331341aa03e789ebe6e737a29bf4c8a5cbb51dcbb52d9d90dc6120feb3768640` | `0x70b57cb0548cad38da72c5788d483b67b772abd63ba463d95ac4a2ecf7d2ed46` |

`skuInfo` for all four returns `market = 0x0000000000000000000000000000000000000000`, `vaulted = 1` (checked
2026-10-05).

Demo funds: MON → USDC swap `0xf5cb9beed90beab6d0cc7ef4d26578b175366784dda1d1393394f0b31cf411ea`.

App check (2026-10-05, `VITE_NETWORK=mainnet`, headless Chromium with a PRF passkey): the four DEMO cards load from
mainnet with the demo notice and "Market opening soon — awaiting Kuru listing", no trading controls, and no call to the
zero address.
