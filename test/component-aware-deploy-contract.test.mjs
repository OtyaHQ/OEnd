import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')

test('full validation remains mandatory before production authorization and planning', () => {
  assert.match(workflow, /validate:\\n[\\s\\S]*Validate OEnd web/)
  assert.match(workflow, /authorize-deploy:[\\s\\S]*needs: validate/)
  assert.match(workflow, /plan-deploy:[\\s\\S]*needs: \\[validate, authorize-deploy\\]/)
  assert.match(workflow, /Validate auth worker/)
  assert.match(workflow, /Validate O worker/)
  assert.match(workflow, /Validate Opoint backend, security boundaries and dashboard build/)
  assert.match(workflow, /Validate Omy Play backend source and schema contract/)
})

test('runtime deployment is selected explicitly by canonical product name', () => {
  assert.match(workflow, /default: 'validate-only'/)
  assert.match(workflow, /oid=false/)
  assert.match(workflow, /o=false/)
  assert.match(workflow, /oend=false/)
  for (const component of ['oid','o','oend','opoint','omy-play']) {
    assert.match(workflow, new RegExp('\\\\b' + component + '\\\\)'))
  }
  assert.match(workflow, /all\\)[\\s\\S]*oid=true[\\s\\S]*o=true[\\s\\S]*oend=true[\\s\\S]*opoint=true[\\s\\S]*omy_play=true/)
  assert.doesNotMatch(workflow, /No usable previous commit; conservatively deploying all runtime components/)
})

test('O bootstraps against existing Core, OEnd then deploys, and O is finalized against OEnd', () => {
  assert.match(workflow, /deploy-o:[\\s\\S]*needs: \\[validate, authorize-deploy, plan-deploy, deploy-oid\\]/)
  assert.match(workflow, /sed 's\/service = "oend"\/service = "otya-core"\/' wrangler.toml > wrangler.bootstrap.toml/)
  assert.match(workflow, /deploy-oend:[\\s\\S]*needs: \\[validate, authorize-deploy, plan-deploy, deploy-oid, deploy-o\\]/)
  assert.match(workflow, /deploy-o-final:[\\s\\S]*needs: \\[validate, authorize-deploy, plan-deploy, deploy-o, deploy-oend\\]/)
  assert.match(workflow, /grep -q 'service = "oend"' wrangler.toml/)
  assert.match(workflow, /deploy-opoint:[\\s\\S]*needs: \\[validate, authorize-deploy, plan-deploy, deploy-oid, deploy-oend\\]/)
  assert.match(workflow, /deploy-omy-play:[\\s\\S]*needs: \\[validate, authorize-deploy, plan-deploy, deploy-oid, deploy-oend\\]/)
})

test('all production components and live verification fail closed without authorization', () => {
  const names = ['deploy-oid','deploy-o','deploy-oend','deploy-o-final','deploy-opoint','deploy-omy-play','verify-production']
  for (let i = 0; i < names.length; i++) {
    const start = workflow.indexOf('  ' + names[i] + ':')
    assert.ok(start >= 0, names[i] + ' exists')
    const next = names[i+1] ? workflow.indexOf('\\n  ' + names[i+1] + ':', start + 1) : workflow.length
    const block = workflow.slice(start, next > start ? next : workflow.length)
    assert.match(block, /needs\\.validate\\.result == 'success'/)
    assert.match(block, /needs\\.authorize-deploy\\.result == 'success'/)
    assert.match(block, /needs\\.plan-deploy\\.result == 'success'/)
  }
  assert.match(workflow, /needs\\.deploy-o-final\\.result == 'success' \\|\\| needs\\.deploy-o-final\\.result == 'skipped'/)
  assert.match(workflow, /needs\\.deploy-omy-play\\.result == 'success' \\|\\| needs\\.deploy-omy-play\\.result == 'skipped'/)
})
