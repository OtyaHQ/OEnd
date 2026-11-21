import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  isAllowedOpointStaffInvitationRole,
  isOpointStaffInvitationPath,
  OPOINT_STAFF_INVITATION_ROLES,
  OPOINT_STAFF_INVITATION_PATH,
} from '../auth-worker/src/opoint-staff-invitation.ts'
test('Opoint invitation contract accepts every canonical workforce role', () => {
  assert.deepEqual(OPOINT_STAFF_INVITATION_ROLES, ['ADMIN','MANAGER','CASHIER','AGENT','ACCOUNTANT','AUDITOR'])
  for (const role of OPOINT_STAFF_INVITATION_ROLES) assert.equal(isAllowedOpointStaffInvitationRole(role), true, role)
})
test('Opoint invitation role validation rejects unknown, empty and injected values', () => {
  for (const role of ['', 'ROOT', 'OWNER; ADMIN', 'OWNER\\nBYPASS', 'cashier', null, 42, 'ATTENDANT', 'MANAGING_DIRECTOR', 'CHAIRMAN']) {
    assert.equal(isAllowedOpointStaffInvitationRole(role), false)
  }
})
test('only the canonical private Opoint invitation path is recognized', () => {
  assert.equal(OPOINT_STAFF_INVITATION_PATH, '/internal/notifications/opoint/staff-invitation')
  assert.equal(isOpointStaffInvitationPath(OPOINT_STAFF_INVITATION_PATH), true)
  assert.equal(isOpointStaffInvitationPath('/internal/notifications/otyapoint/staff-invitation'), false)
  assert.equal(isOpointStaffInvitationPath('/internal/notifications/omnipoint/staff-invitation'), false)
  assert.equal(isOpointStaffInvitationPath('/public/staff-invitation'), false)
})
const productionEntrypoint = readFileSync(new URL('../auth-worker/src/production-entrypoint.ts', import.meta.url), 'utf8')
test('private invitation route requires Opoint service identity and shared secret', () => {
  assert.match(productionEntrypoint, /isOpointStaffInvitationPath\(url\.pathname\)/)
  assert.match(productionEntrypoint, /OPOINT_INVITE_SERVICE_TOKEN/)
  assert.match(productionEntrypoint, /x-otya-service.*opoint/)
  assert.match(productionEntrypoint, /x-otya-service-token/)
  assert.match(productionEntrypoint, /new TextEncoder\(\)\.encode\(rawBody\)\.byteLength > 4096/)
  assert.match(productionEntrypoint, /isAllowedOpointStaffInvitationRole\(role\)/)
})
