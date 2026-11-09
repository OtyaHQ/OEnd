import test from 'node:test';
import assert from 'node:assert/strict';
import { routeTechnicalTask, TECHNICAL_ROLES } from '../src/technical-team.mjs';

test('specialists are logical roles, not separate runtime services', () => {
  assert.ok(TECHNICAL_ROLES.team_lead);
  assert.ok(TECHNICAL_ROLES.security_engineer);
  assert.ok(TECHNICAL_ROLES.otyapoint_operations);
  for (const role of Object.values(TECHNICAL_ROLES)) {
    assert.equal(typeof role.instruction, 'string');
    assert.ok(role.instruction.length > 20);
  }
});

test('routes security and data work before generic backend topics', () => {
  assert.equal(routeTechnicalTask('Review authentication and secret exposure in the API').role, 'security_engineer');
  assert.equal(routeTechnicalTask('Review D1 schema and ledger integrity').role, 'database_engineer');
});

test('routes shop operations separately from provider integration', () => {
  assert.equal(routeTechnicalTask('Improve mobile money float and cash reconciliation').role, 'otyapoint_operations');
  assert.equal(routeTechnicalTask('Review the Interswitch webhook contract').role, 'integration_engineer');
});

test('routes app experience and delivery operations to their specialists', () => {
  assert.equal(routeTechnicalTask('Improve Flutter login screen and dashboard UX').role, 'product_engineer');
  assert.equal(routeTechnicalTask('Investigate Cloudflare Worker deployment workflow').role, 'devops_engineer');
});

test('unknown and blank tasks stay with the team lead without granting access', () => {
  const blank = routeTechnicalTask('');
  assert.equal(blank.role, 'team_lead');
  assert.equal(blank.confidence, 'low');
  assert.equal(blank.advisory_only, true);
  assert.equal(routeTechnicalTask('something unusual').role, 'team_lead');
});
