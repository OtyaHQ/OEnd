import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')

function block(name, next) {
  const start = workflow.indexOf(\`  \${name}:\`)
  assert.ok(start >= 0, \`\${name} must exist\`)
  const end = next ? workflow.indexOf(\`\\n  \${next}:\`, start + 1) : workflow.length
  assert.ok(end > start, \`\${next ?? 'end'} must follow \${name}\`)
  return workflow.slice(start, end)
}

test('full validation remains mandatory before production authorization and planning', () => {
  assert.match(workflow, /validate:[\\s\\S]*Validate OEnd web/)
  assert.match(workflow, /authorize-deploy:[\\s\\S]*needs: validate/)
  assert.match(workflow, /plan-deploy:[\\s\\S]*needs: \\[validate, authorize-deploy\\]/)
  assert.match(workflow, /Validate auth worker/)
  assert.match(workflow, /Validate O worker/)
  assert.match(workflow, /Validate Opoint backend, security boundaries and dashboard build/)
  assert.match(workflow, /Validate Omy Play backend source and schema contract/)
})

test('runtime deployment is selected explicitly by canonical product name', () => {
  const plan = block('plan-deploy', 'deploy-oid')
  assert.match(plan, /oid=false/)
  assert.match(plan, /o=false/)
  assert.match(plan, /oend=false/)
  for (const component of ['oid', 'o', 'oend', 'opoint', 'omy-play']) {
    assert.ok(plan.includes(\`\${component})\`), \`\${component} must be a selectable component\`)
  }
  assert.match(plan, /all\\)[\\s\\S]*oid=true[\\s\\S]*o=true[\\s\\S]*oend=true[\\s\\S]*opoint=true[\\s\\S]*omy_play=true/)
  assert.doesNotMatch(workflow, /No usable previous commit; conservatively deploying all runtime components/)
})

test('O bootstraps against existing Core, OEnd deploys next, then O is finalized against OEnd', () => {
  const o = block('deploy-o', 'deploy-oend')
  const oend = block('deploy-oend', 'deploy-o-final')
  const finalO = block('deploy-o-final', 'deploy-opoint')

  assert.match(o, /needs: \\[validate, authorize-deploy, plan-deploy, deploy-oid\\]/)
  assert.match(o, /sed 's\\/service = "oend"\\/service = "otya-core"\\/' wrangler\\.toml > wrangler\\.bootstrap\\.toml/)
  assert.match(oend, /needs: \\[validate, authorize-deploy, plan-deploy, deploy-oid, deploy-o\\]/)
  assert.match(finalO, /needs: \\[validate, authorize-deploy, plan-deploy, deploy-o, deploy-oend\\]/)
  assert.match(finalO, /grep -q 'service = "oend"' wrangler\\.toml/)
})

test('Opoint and Omy Play deploy only after OID and OEnd', () => {
  assert.match(block('deploy-opoint', 'deploy-omy-play'), /deploy-oid, deploy-oend/)
  assert.match(block('deploy-omy-play', 'verify-production'), /deploy-oid, deploy-oend/)
})

test('live verification is gated by validation, authorization and every selected deployment', () => {
  const verify = block('verify-production', null)
  for (const name of ['deploy-oid', 'deploy-o', 'deploy-oend', 'deploy-o-final', 'deploy-opoint', 'deploy-omy-play']) {
    assert.match(verify, new RegExp(\`needs\\\\.\${name}\\\\.result == 'success' \\\\|\\\\| needs\\\\.\${name}\\\\.result == 'skipped'\`))
  }
  assert.match(verify, /needs\\.authorize-deploy\\.result == 'success'/)
  assert.match(verify, /needs\\.plan-deploy\\.outputs\\.any_runtime == 'true'/)
})
