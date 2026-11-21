import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
function jobBlock(name) {
  const start = workflow.indexOf('  ' + name + ':\n')
  assert.ok(start >= 0, 'job ' + name + ' must exist')
  const rest = workflow.slice(start + 1)
  const next = /\n  [a-z][a-z0-9-]*:\n/.exec(rest)
  return workflow.slice(start, next ? start + 1 + next.index : workflow.length)
}
test('production workflow defaults to validation-only and requires exact DEPLOY confirmation', () => {
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /default: 'validate-only'/)
  assert.match(workflow, /Type DEPLOY to authorize the selected production release/)
  const authorize = jobBlock('authorize-deploy')
  assert.match(authorize, /needs: validate/)
  assert.match(authorize, /test "\$TARGET_REF" = 'refs\/heads\/main'/)
  assert.match(authorize, /test "\$CONFIRM" = 'DEPLOY'/)
  assert.match(authorize, /case "\$COMPONENT" in/)
})
test('only canonical production component names may be selected', () => {
  const authorize = jobBlock('authorize-deploy')
  assert.match(authorize, /oid\|o\|oend\|opoint\|omy-play\|all/)
  const plan = jobBlock('plan-deploy')
  for (const name of ['oid','o','oend','opoint','omy_play']) {
    assert.match(plan, new RegExp('^\\s*' + name + '=false$', 'm'))
    assert.ok(plan.includes(name + '=true'))
  }
})
test('every live deployment job requires main, validation, authorization and plan', () => {
  for (const name of ['deploy-oid','deploy-o','deploy-oend','deploy-o-final','deploy-opoint','deploy-omy-play','verify-production']) {
    const block=jobBlock(name)
    assert.match(block,/github\.ref == 'refs\/heads\/main'/,name)
    assert.match(block,/needs\.validate\.result == 'success'/,name)
    assert.match(block,/needs\.authorize-deploy\.result == 'success'/,name)
    assert.match(block,/needs\.plan-deploy\.result == 'success'/,name)
  }
})
test('dependent products cannot deploy before their shared services', () => {
  assert.match(jobBlock('deploy-o'),/needs: \[validate, authorize-deploy, plan-deploy, deploy-oid\]/)
  assert.match(jobBlock('deploy-oend'),/needs: \[validate, authorize-deploy, plan-deploy, deploy-oid, deploy-o\]/)
  assert.match(jobBlock('deploy-o-final'),/needs: \[validate, authorize-deploy, plan-deploy, deploy-o, deploy-oend\]/)
  assert.match(jobBlock('deploy-opoint'),/deploy-oid, deploy-oend/)
  assert.match(jobBlock('deploy-omy-play'),/deploy-oid, deploy-oend/)
})
