import test from 'node:test'
import assert from 'node:assert/strict'
import { isAllowedOtyaPointProxyRequest, otyaPointUpstreamPath } from '../src/lib/otya-point-proxy-policy.mjs'

const origin = 'https://space.petersmartlink.com'

test('allows same-origin reads without requiring an Origin header', () => {
  assert.equal(isAllowedOtyaPointProxyRequest({
    method: 'GET',
    origin: null,
    requestOrigin: origin,
    secFetchSite: 'same-origin',
  }), true)
})

test('requires an exact Origin match for every mutation', () => {
  assert.equal(isAllowedOtyaPointProxyRequest({
    method: 'POST',
    origin,
    requestOrigin: origin,
    secFetchSite: 'same-origin',
  }), true)
  assert.equal(isAllowedOtyaPointProxyRequest({
    method: 'POST',
    origin: null,
    requestOrigin: origin,
    secFetchSite: 'same-origin',
  }), false)
  assert.equal(isAllowedOtyaPointProxyRequest({
    method: 'POST',
    origin: 'https://attacker.invalid',
    requestOrigin: origin,
    secFetchSite: 'cross-site',
  }), false)
})

test('rejects cross-site requests and unsupported mutation methods', () => {
  assert.equal(isAllowedOtyaPointProxyRequest({
    method: 'DELETE',
    origin,
    requestOrigin: origin,
    secFetchSite: 'cross-site',
  }), false)
  assert.equal(isAllowedOtyaPointProxyRequest({
    method: 'PUT',
    origin,
    requestOrigin: origin,
    secFetchSite: 'same-origin',
  }), false)
})

test('constructs fixed API paths and rejects traversal or empty segments', () => {
  assert.equal(otyaPointUpstreamPath(['products']), '/api/products')
  assert.equal(otyaPointUpstreamPath(['staff', 'invitations']), '/api/staff/invitations')
  assert.equal(otyaPointUpstreamPath([]), null)
  assert.equal(otyaPointUpstreamPath(['..']), null)
  assert.equal(otyaPointUpstreamPath(['products/../../auth']), null)
})
