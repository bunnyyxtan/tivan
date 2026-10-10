// Self-check for the plugin's pure logic: card ids from token symbols, market labels, and Kuru's price units.
// Run with `npm test` (Node strips the TypeScript types).
import assert from 'node:assert/strict'
import { findMarket, idOf, parseLabel, toCents } from '../src/tivan.ts'

// A card's short id is its token symbol turned around, so ids never need a list kept by hand.
assert.equal(idOf('PSA10-CHZ'), 'CHZ10')
assert.equal(idOf('PSA9-CHZ'), 'CHZ9', 'grade is part of the id')
assert.equal(idOf('PSA6-RUTH33'), 'RUTH336')
assert.equal(idOf('PSA9.5-CHZ'), 'CHZ9.5')
assert.equal(idOf('ODDSYMBOL'), 'ODDSYMBOL', 'an unexpected symbol is used as it is')

// The vault's market name splits into grade and card.
assert.deepEqual(parseLabel('PSA 10 Base Set Charizard Holo'), { grade: 10, card: 'Base Set Charizard Holo' })
assert.deepEqual(parseLabel('PSA 6 Goudey Sport Kings Babe Ruth #2'), { grade: 6, card: 'Goudey Sport Kings Babe Ruth #2' })

const markets = [{ id: 'CHZ10', card: 'Base Set Charizard Holo', grade: 10, market: null }]
assert.equal(findMarket(markets, 'chz10')?.grade, 10, 'card ids are case-insensitive')
assert.equal(findMarket(markets, 'nope'), undefined)

// Prices are whole cents in a uint32; sizes are whole cards.
assert.equal(toCents(4800), 480000)
assert.equal(toCents(0.01), 1)
assert.throws(() => toCents(0), /out of range/)
assert.throws(() => toCents(-5), /out of range/)
assert.throws(() => toCents(43_000_000), /out of range/) // over uint32 cents
console.log('ok — ids, labels and unit maths check out')
