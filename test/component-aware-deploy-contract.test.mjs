import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
const config = readFileSync(new URL('../wrangler.toml', import.meta.url), 'utf8')
function jobBlock(name) {
  const start = workflow.indexOf('  ' + name + ':\n')
  assert.ok(start >= 0, 'job ' + name + ' must exist')
  const rest = workflow.slice(start + 1)
  const next = /\n  [a-z][a-z0-9-]*:\n/.exec(rest)
  return workflow.slice(start, next ? start + 1 + next.index : workflow.length)
}
test('full OID, O, OEnd, Opoint and Omy Play validation runs before production authorization', () => {
  const validate = jobBlock('validate')
  assert.match(validate, /npm test/)
  assert.match(validate, /npm run build/)
  assert.match(validate, /npm run typecheck/)
  assert.match(validate, /Validate auth worker/)
  assert.match(validate, /Validate O worker/)
  assert.match(validate, /Validate Opoint backend, security boundaries and dashboard build/)
  assert.match(validate, /Verify Omy Play backend source and schema contract/)
  assert.match(jobBlock('deploy-omy-play'), /ref: \\${\\{ needs\\.validate\\.outputs\\.omy_play_sha \\}\\}/)
  assert.ok(workflow.indexOf('  authorize-deploy:\n') > workflow.indexOf('  validate:\n'))
})
test('production authorization is explicit, main-branch-only and exact-token gated', () => {
  const authorization = jobBlock('authorize-deploy')
  assert.match(authorization, /needs: validate/)
  assert.match(authorization, /github\.event_name == 'workflow_dispatch'/)
  assert.match(authorization, /inputs\.component != 'validate-only'/)
  assert.match(authorization, /github\.ref == 'refs\/heads\/main'/)
  assert.match(authorization, /test "\$TARGET_REF" = 'refs\/heads\/main'/)
  assert.match(authorization, /test "\$CONFIRM" = 'DEPLOY'/)
  assert.match(authorization, /oid\|o\|oend\|opoint\|omy-play\|all/)
})
test('runtime component selection is explicit and dependency-aware', () => {
  const plan = jobBlock('plan-deploy')
  for (const key of ['oid','o','oend','opoint','omy_play']) {
    assert.match(plan, new RegExp('^\\s*' + key + '=false$', 'm'))
    assert.ok(plan.includes(key + '=true'), key + ' must be selectable')
  }
  assert.match(plan, /case "\$COMPONENT" in/)
  assert.match(plan, /all\)[\s\S]*oid=true[\s\S]*o=true[\s\S]*oend=true[\s\S]*opoint=true[\s\S]*omy_play=true/)
  assert.match(plan, /any_runtime=true/)
})
test('O bootstraps against existing OEnd predecessor, OEnd deploys next, then O binds canonically', () => {
  const oid=jobBlock('deploy-oid'), o=jobBlock('deploy-o'), oend=jobBlock('deploy-oend'), finalO=jobBlock('deploy-o-final')
  assert.match(oid, /needs: \[validate, authorize-deploy, plan-deploy\]/)
  assert.match(o, /needs: \[validate, authorize-deploy, plan-deploy, deploy-oid\]/)
  assert.match(o, /service = "otya-core"/)
  assert.match(oend, /needs: \[validate, authorize-deploy, plan-deploy, deploy-oid, deploy-o\]/)
  assert.match(finalO, /needs: \[validate, authorize-deploy, plan-deploy, deploy-o, deploy-oend\]/)
  assert.match(finalO, /service = "oend"/)
})
test('Opoint and Omy Play deploy only after OID and OEnd', () => {
  assert.match(jobBlock('deploy-opoint'), /needs: \[validate, authorize-deploy, plan-deploy, deploy-oid, deploy-oend\]/)
  assert.match(jobBlock('deploy-omy-play'), /needs: \[validate, authorize-deploy, plan-deploy, deploy-oid, deploy-oend\]/)
})
test('live verification remains behind selected deployment jobs and authorization', () => {
  const verify=jobBlock('verify-production')
  assert.match(verify, /needs: \[validate, authorize-deploy, plan-deploy, deploy-oid, deploy-o, deploy-oend, deploy-o-final, deploy-opoint, deploy-omy-play\]/)
  assert.match(verify, /needs\.validate\.result == 'success'/)
  assert.match(verify, /needs\.authorize-deploy\.result == 'success'/)
  assert.match(verify, /needs\.plan-deploy\.outputs\.any_runtime == 'true'/)
  assert.match(config, /name = "oend"/)
})
