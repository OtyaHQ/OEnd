import test from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedOpointProxyRequest, opointUpstreamPath } from '../src/lib/opoint-proxy-policy.mjs'

const origin = 'https://space.otya.site'

test('allows same-origin reads without requiring an Origin header', () => {
  assert.equal(isAllowedOpointProxyRequest({
    method: 'GET',
    origin: null,
    requestOrigin: origin,
    secFetchSite: 'same-origin',
  }), true)
})

test('requires an exact Origin match for every mutation', () => {
  assert.equal(isAllowedOpointProxyRequest({
    method: 'POST',
    origin,
    requestOrigin: origin,
    secFetchSite: 'same-origin',
  }), true)
  assert.equal(isAllowedOpointProxyRequest({
    method: 'POST',
    origin: null,
    requestOrigin: origin,
    secFetchSite: 'same-origin',
  }), false)
  assert.equal(isAllowedOpointProxyRequest({
    method: 'POST',
    origin: 'https://attacker.invalid',
    requestOrigin: origin,
    secFetchSite: 'cross-site',
  }), false)
})

test('rejects cross-site requests and unsupported mutation methods', () => {
  assert.equal(isAllowedOpointProxyRequest({
    method: 'DELETE',
    origin,
    requestOrigin: origin,
    secFetchSite: 'cross-site',
  }), false)
  assert.equal(isAllowedOpointProxyRequest({
    method: 'PUT',
    origin,
    requestOrigin: origin,
    secFetchSite: 'same-origin',
  }), false)
})

test('constructs fixed API paths and rejects traversal or empty segments', () => {
  assert.equal(opointUpstreamPath(['products']), '/api/products')
  assert.equal(opointUpstreamPath(['staff', 'invitations']), '/api/staff/invitations')
  assert.equal(opointUpstreamPath([]), null)
  assert.equal(opointUpstreamPath(['..']), null)
  assert.equal(opointUpstreamPath(['products/../../auth']), null)
  assert.equal(opointUpstreamPath(['evil\\auth']), null)
})

test('allows only methods implemented by the private Opoint API', () => {
  for (const method of ['GET', 'POST', 'PATCH']) {
    assert.equal(isAllowedOpointProxyRequest({
      method,
      origin: method === 'GET' ? null : origin,
      requestOrigin: origin,
      secFetchSite: 'same-origin',
    }), true)
  }
  for (const method of ['HEAD', 'DELETE', 'PUT', 'OPTIONS']) {
    assert.equal(isAllowedOpointProxyRequest({
      method,
      origin,
      requestOrigin: origin,
      secFetchSite: 'same-origin',
    }), false)
  }
})
