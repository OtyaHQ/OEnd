import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isAllowedOtyaPointStaffInvitationRole,
  isOtyaPointStaffInvitationPath,
  OTYAPOINT_STAFF_INVITATION_ROLES,
  LEGACY_COMPAT_STAFF_INVITATION_ROLES,
  OTYAPOINT_STAFF_INVITATION_PATH,
  LEGACY_COMPAT_STAFF_INVITATION_PATH,
} from '../auth-worker/src/otyapoint-staff-invitation.ts'

test('OtyaPoint invitation contract accepts every canonical workforce role', () => {
  assert.deepEqual(OTYAPOINT_STAFF_INVITATION_ROLES, [
    'OWNER',
    'ADMIN',
    'MANAGER',
    'CASHIER',
    'AGENT',
    'ACCOUNTANT',
    'AUDITOR',
  ])
  for (const role of OTYAPOINT_STAFF_INVITATION_ROLES) {
    assert.equal(isAllowedOtyaPointStaffInvitationRole(role), true, role)
  }
})

test('legacy role values remain an explicit compatibility-only set', () => {
  assert.deepEqual(LEGACY_COMPAT_STAFF_INVITATION_ROLES, [
    'ATTENDANT',
    'MANAGING_DIRECTOR',
    'CHAIRMAN',
  ])
  for (const role of LEGACY_COMPAT_STAFF_INVITATION_ROLES) {
    assert.equal(isAllowedOtyaPointStaffInvitationRole(role), true, role)
  }
})

test('invitation role validation rejects unknown, empty and injected values', () => {
  for (const role of ['', 'ROOT', 'OWNER; ADMIN', 'OWNER\nBYPASS', 'cashier', null, 42]) {
    assert.equal(isAllowedOtyaPointStaffInvitationRole(role), false)
  }
})

test('canonical and legacy private invitation paths are recognized', () => {
  assert.equal(OTYAPOINT_STAFF_INVITATION_PATH, '/internal/notifications/otyapoint/staff-invitation')
  assert.equal(LEGACY_COMPAT_STAFF_INVITATION_PATH, '/internal/notifications/omnipoint/staff-invitation')
  assert.equal(isOtyaPointStaffInvitationPath(OTYAPOINT_STAFF_INVITATION_PATH), true)
  assert.equal(isOtyaPointStaffInvitationPath(LEGACY_COMPAT_STAFF_INVITATION_PATH), true)
  assert.equal(isOtyaPointStaffInvitationPath('/public/staff-invitation'), false)
})

const productionEntrypoint = readFileSync(
  new URL('../auth-worker/src/production-entrypoint.ts', import.meta.url),
  'utf8',
)

test('private invitation route checks caller secret and bounds all request bodies', () => {
  assert.match(productionEntrypoint, /isOtyaPointStaffInvitationPath\(url\.pathname\)/)
  assert.match(productionEntrypoint, /x-otya-service-token/)
  assert.match(productionEntrypoint, /x-otya-service.*otyapoint/)
  assert.match(productionEntrypoint, /encode\(rawBody\)\.byteLength > 4096/)
  assert.match(productionEntrypoint, /Invalid invitation ID/)
  assert.match(productionEntrypoint, /isAllowedOtyaPointStaffInvitationRole\(role\)/)
  assert.match(productionEntrypoint, /Invalid invitation token/)
  assert.match(productionEntrypoint, /Invalid invitation expiry/)
})
