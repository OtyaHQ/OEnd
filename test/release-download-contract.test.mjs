import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Omy Play downloads use the private product API through the OEnd gateway', () => {
  const download = read('src/app/download/omy-play/DownloadButtons.tsx')
  const gateway = read('src/app/api/omy-play/[...path]/route.ts')
  assert.equal(existsSync(new URL('../src/app/apk/[file]/route.ts', import.meta.url)), false)
  assert.match(download, /fetch\('\/api\/omy-play\/latest'/)
  assert.match(download, /\/api\/omy-play\/apk\/\$\{targetAbi\}/)
  assert.match(download, /latest\.available === true/)
  assert.match(download, /No public Android release is available yet/)
  assert.match(gateway, /OMY_PLAY_API/)
  assert.match(gateway, /ALLOWED_PATHS/)
  assert.match(gateway, /same_origin_required/)
  assert.match(gateway, /private, no-store/)
})

test('release manifests preserve immutable version and Android version-code validation', () => {
  const workflow = read('src/release-workflow.mjs')
  assert.match(workflow, /const TAG_RE/)
  assert.match(workflow, /tagVersion !== version/)
  assert.match(workflow, /tagBuild !== versionCode/)
  assert.match(workflow, /tag build and versionCode do not match/)
  assert.match(workflow, /latest\.tag !== release\.tag/)
  assert.match(workflow, /Number\(latest\.version_code\) >= release\.versionCode/)
  assert.match(workflow, /Refusing non-monotonic version code/)
})
