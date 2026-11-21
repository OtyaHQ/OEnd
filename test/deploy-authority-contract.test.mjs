import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync(
  new URL('../.github/workflows/deploy.yml', import.meta.url),
  'utf8',
)

function jobBlock(name, nextName) {
  const start = workflow.indexOf(`  ${name}:`)
  assert.ok(start >= 0, `${name} must exist`)
  const end = nextName ? workflow.indexOf(`\n  ${nextName}:`, start + 1) : workflow.length
  assert.ok(end > start, `${nextName ?? 'end of workflow'} must follow ${name}`)
  return workflow.slice(start, end)
}

test('production deploys require validation and an explicit deployment authorization', () => {
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /default: 'validate-only'/)
  assert.match(workflow, /Type DEPLOY to authorize the selected production release/)

  const authorization = jobBlock('authorize-deploy', 'plan-deploy')
  assert.match(authorization, /github\.event_name == 'workflow_dispatch' && inputs\.component != 'validate-only'/)
  assert.match(authorization, /github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' && contains\(github\.event\.head_commit\.message, '\[DEPLOY-ALL\]'\)/)
  assert.match(authorization, /test "\$TARGET_REF" = 'refs\/heads\/main'/)
  assert.match(authorization, /test "\$CONFIRM" = 'DEPLOY'/)
  assert.match(authorization, /case "\$COMPONENT" in/)

  const plan = jobBlock('plan-deploy', 'deploy-oid')
  assert.match(plan, /needs: \[validate, authorize-deploy\]/)
  assert.match(plan, /oid=false/)
  assert.match(plan, /o=false/)
  assert.match(plan, /oend=false/)
  assert.match(plan, /all\)[\s\S]*oid=true[\s\S]*o=true[\s\S]*oend=true/)
})

test('each production component depends on successful validation and authorization', () => {
  const blocks = [
    jobBlock('deploy-oid', 'deploy-o'),
    jobBlock('deploy-o', 'deploy-oend'),
    jobBlock('deploy-oend', 'deploy-o-final'),
    jobBlock('deploy-o-final', 'deploy-opoint'),
    jobBlock('deploy-opoint', 'deploy-omy-play'),
    jobBlock('deploy-omy-play', 'verify-production'),
    jobBlock('verify-production'),
  ]
  for (const block of blocks) {
    assert.match(block, /github\.ref == 'refs\/heads\/main'/)
    assert.match(block, /needs\.validate\.result == 'success'/)
    assert.match(block, /needs\.authorize-deploy\.result == 'success'/)
    assert.match(block, /needs\.plan-deploy\.result == 'success'/)
  }
})
