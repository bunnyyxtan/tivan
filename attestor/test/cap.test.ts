import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cap, clientIp, resetCap, HttpError } from '../src/cap.ts'

const refused = (fn: () => void) => {
  try {
    fn()
  } catch (e) {
    return e instanceof HttpError && e.status === 429
  }
  return false
}

test('cap allows up to the limit, then refuses with 429', () => {
  resetCap()
  for (let i = 0; i < 3; i++) cap('nope', ['k', 3])
  assert.ok(refused(() => cap('nope', ['k', 3])))
})

test('separate keys hold separate quotas', () => {
  resetCap()
  cap('nope', ['a', 1])
  assert.ok(refused(() => cap('nope', ['a', 1])))
  assert.doesNotThrow(() => cap('nope', ['b', 1]))
})

test('a refusal on any limit costs no quota on the others', () => {
  resetCap()
  cap('nope', ['narrow', 1], ['wide', 10])
  assert.ok(refused(() => cap('nope', ['narrow', 1], ['wide', 10])))
  // the refused call must not have consumed a 'wide' slot: 9 remain, not 8
  for (let i = 0; i < 9; i++) cap('nope', ['wide', 10])
  assert.ok(refused(() => cap('nope', ['wide', 10])))
})

test('hits older than an hour stop counting', () => {
  resetCap()
  const real = Date.now
  try {
    Date.now = () => 0
    cap('nope', ['k', 1])
    assert.ok(refused(() => cap('nope', ['k', 1])))
    Date.now = () => 3600_001
    assert.doesNotThrow(() => cap('nope', ['k', 1]))
  } finally {
    Date.now = real
  }
})

test('the caller IP prefers the edge header, then the last forwarded hop', () => {
  const req = (headers: Record<string, string>) => ({ headers, socket: { remoteAddress: '10.0.0.1' } }) as never
  assert.equal(clientIp(req({ 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9' })), '1.1.1.1')
  assert.equal(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 2.2.2.2' })), '2.2.2.2', 'a forged first hop is ignored')
  assert.equal(clientIp(req({})), '10.0.0.1')
})
