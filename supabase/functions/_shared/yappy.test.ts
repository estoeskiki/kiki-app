// Run: node --experimental-strip-types --test supabase/functions/_shared/yappy.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { buildYappyAmounts, centsToYappy, computeYappyHash, validateYappyHash } from './yappy.ts'

// Same shape as a real CLAVE_SECRETA: base64 of "<hmac key>.<other segment>".
const SECRET = Buffer.from('my-hmac-key.second-part').toString('base64')
const ORDER = '3f9c2a7e1b4d4e8fa6c05d2e9b7a1c34'
const DOMAIN = 'https://order.estoeskiki.com'

function nodeHash(secret: string, msg: string): string {
  const key = Buffer.from(secret, 'base64').toString('utf-8').split('.')[0]
  return createHmac('sha256', key).update(msg, 'utf8').digest('hex')
}

test('hash matches node:crypto reference', async () => {
  for (const status of ['E', 'C', 'X']) {
    assert.equal(await computeYappyHash(SECRET, ORDER, status, DOMAIN), nodeHash(SECRET, ORDER + status + DOMAIN))
  }
})

test('valid hash accepted, uppercase accepted', async () => {
  const h = nodeHash(SECRET, ORDER + 'E' + DOMAIN)
  assert.equal(await validateYappyHash(SECRET, ORDER, 'E', DOMAIN, h), true)
  assert.equal(await validateYappyHash(SECRET, ORDER, 'E', DOMAIN, h.toUpperCase()), true)
})

test('bad, wrong-status, wrong-domain and different-length hashes rejected', async () => {
  const h = nodeHash(SECRET, ORDER + 'E' + DOMAIN)
  assert.equal(await validateYappyHash(SECRET, ORDER, 'E', DOMAIN, 'deadbeef'), false)
  assert.equal(await validateYappyHash(SECRET, ORDER, 'E', DOMAIN, h.slice(0, -1)), false)
  assert.equal(await validateYappyHash(SECRET, ORDER, 'E', DOMAIN, h.slice(0, -1) + (h.endsWith('0') ? '1' : '0')), false)
  assert.equal(await validateYappyHash(SECRET, ORDER, 'C', DOMAIN, h), false)
  assert.equal(await validateYappyHash(SECRET, ORDER, 'E', DOMAIN + '/', h), false)
  assert.equal(await validateYappyHash(SECRET, ORDER, 'E', DOMAIN, ''), false)
  assert.equal(await validateYappyHash(SECRET, ORDER, 'E', DOMAIN, null), false)
})

test('secret without "." uses the whole decoded text as key', async () => {
  const s = Buffer.from('nodotkey').toString('base64')
  assert.equal(await computeYappyHash(s, ORDER, 'E', DOMAIN), createHmac('sha256', 'nodotkey').update(ORDER + 'E' + DOMAIN).digest('hex'))
})

test('malformed secret never validates', async () => {
  assert.equal(await validateYappyHash('%%%not-base64', ORDER, 'E', DOMAIN, 'deadbeef'), false)
})

test('centsToYappy', () => {
  assert.equal(centsToYappy(0), '0.00')
  assert.equal(centsToYappy(1), '0.01')
  assert.equal(centsToYappy(99), '0.99')
  assert.equal(centsToYappy(100), '1.00')
  assert.equal(centsToYappy(535), '5.35')
  assert.equal(centsToYappy(999999), '9999.99')
  assert.throws(() => centsToYappy(1000000), RangeError)
  assert.throws(() => centsToYappy(-1), RangeError)
  assert.throws(() => centsToYappy(5.5), RangeError)
})

test('buildYappyAmounts enforces subtotal + taxes = total and range', () => {
  assert.deepEqual(buildYappyAmounts(500, 35), { subtotal: '5.00', taxes: '0.35', shipping: '0.00', discount: '0.00', total: '5.35' })
  assert.throws(() => buildYappyAmounts(0, 0), RangeError)
  assert.throws(() => buildYappyAmounts(999999, 1), RangeError)
})
