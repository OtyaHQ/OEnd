import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')

function jobBlock(name) {
  const start = workflow.indexOf(`  ${name}:\n`)
  assert.ok(start >= 0, `job ${name} must exist`)
  const remainder = workflow.slice(start + 1)
  const next = /\n  [a-z][a-z0-9-]*:\n/.exec(remainder)
  const end = next ? start + 1 + next.index : workflow.length
  return workflow.slice(start, end)
}

test('production workflow defaults to validation-only and requires the exact DEPLOY confirmation', () => {
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
  for (const component of ['oid', 'o', 'oend', 'opoint', 'omy_play']) {
    assert.match(plan, new RegExp(`^${component}=false$`, 'm'))
    assert.ok(plan.includes(`${component}=true`))
  }
})

test('every live deployment job requires main, successful validation, authorization and plan', () => {
  const names = [
    'deploy-oid',
    'deploy-o',
    'deploy-oend',
    'deploy-o-final',
    'deploy-opoint',
    'deploy-omy-play',
    'verify-production',
  ]
  for (const name of names) {
    const block = jobBlock(name)
    assert.match(block, /github\.ref == 'refs\/heads\/main'/, name)
    assert.match(block, /needs\.validate\.result == 'success'/, name)
    assert.match(block, /needs\.authorize-deploy\.result == 'success'/, name)
    assert.match(block, /needs\.plan-deploy\.result == 'success'/, name)
  }
})

test('dependency order cannot let a dependent product deploy before its shared services', () => {
  assert.match(jobBlock('deploy-o'), /needs: \[validate, authorize-deploy, plan-deploy, deploy-oid\]/)
  assert.match(jobBlock('deploy-oend'), /needs: \[validate, authorize-deploy, plan-deploy, deploy-oid, deploy-o\]/)
  assert.match(jobBlock('deploy-o-final'), /needs: \[validate, authorize-deploy, plan-deploy, deploy-o, deploy-oend\]/)
  assert.match(jobBlock('deploy-opoint'), /deploy-oid, deploy-oend/)
  assert.match(jobBlock('deploy-omy-play'), /deploy-oid, deploy-oend/)
})
