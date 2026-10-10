// Self-check for the plugin's pure logic: SKU derivation and Kuru's price/size units.
// Run with `npm test` (Node strips the TypeScript types). Expected SKUs are the published ones in
// docs/mainnet-markets.md, which SlabVault.skuOf produced on chain — keccak(abi.encode(specId, grade)).
import assert from 'node:assert/strict'
import { CARDS, findCard, skuOf, toCents } from '../src/tivan.ts'

assert.equal(skuOf(58n, 10), '0xa5d50f82a15a819238a33e2a19ad83e1db0d3b8b39935b937d9c5f45cdaa4223', 'Pikachu PSA 10')
assert.equal(skuOf(4n, 10), '0xe1eb2b2161a492c07c5a334e48012567cba93ec021043f53c1955516a3c5a841', 'Charizard PSA 10')
assert.equal(skuOf(1993232n, 9), '0x8cebbd8cb0e263a4539f57a7b613c138400a2956a0055855df8c3fe08c2ef30c', 'Black Lotus PSA 9')

// A grade is part of the SKU, so the same card at two grades is two markets.
assert.notEqual(skuOf(4n, 10), skuOf(4n, 9))

// Prices are whole cents in a uint32; sizes are whole cards.
assert.equal(toCents(4800), 480000)
assert.equal(toCents(0.01), 1)
assert.throws(() => toCents(0), /out of range/)
assert.throws(() => toCents(-5), /out of range/)
assert.throws(() => toCents(43_000_000), /out of range/) // over uint32 cents

assert.equal(findCard('chz10')?.spec, 4n, 'card ids are case-insensitive')
assert.equal(findCard('nope'), undefined)
assert.equal(new Set(CARDS.map((c) => c.id)).size, CARDS.length, 'card ids are unique')

// `mm tivan orders` names a book from the indexer and finds its short id by the same label the vault lists,
// `PSA <grade> <name>`. If a card's name drifts from the on-chain name, the id column silently goes blank.
const label = (c) => `PSA ${c.grade} ${c.name}`
assert.equal(new Set(CARDS.map(label)).size, CARDS.length, 'one label per card')
assert.equal(CARDS.find((c) => label(c) === 'PSA 10 Base Set Charizard Holo')?.id, 'CHZ10')
assert.equal(CARDS.find((c) => label(c) === 'PSA 9 Base Set Charizard Holo')?.id, 'CHZ9', 'grade is part of the label')
console.log(`ok — ${CARDS.length} cards, sku and unit maths check out`)
