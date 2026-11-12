import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')

test('Omy Play release metadata fails closed for legacy or mismatched application packages', () => {
  const latest = read('src/app/latest/route.ts')
  assert.match(latest, /const APPLICATION_ID = 'com\.otya\.omyplay'/)
  assert.match(latest, /const PRODUCT_CODE = 'OMY_PLAY'/)
  assert.match(latest, /info\.applicationId !== APPLICATION_ID/)
  assert.match(latest, /info\.productCode !== PRODUCT_CODE/)
  assert.match(latest, /releases\/'.*OmyPlay-arm64\.apk/)
  assert.match(latest, /releases\/'.*OmyPlay-arm32\.apk/)
  assert.match(latest, /X-OTYA-Release-State/)
  assert.doesNotMatch(latest, /petersmartlink\.com|Otya-arm64\.apk|Otya-arm32\.apk/)
})

test('Omy Play release publisher sends its exact package identity and immutable artifact keys', () => {
  const workflow = read('src/release-workflow.mjs')
  assert.match(workflow, /productCode = requireString\(raw\.productCode/)
  assert.match(workflow, /applicationId = requireString\(raw\.applicationId/)
  assert.match(workflow, /productCode !== 'OMY_PLAY'/)
  assert.match(workflow, /applicationId !== 'com\.otya\.omyplay'/)
  assert.match(workflow, /OmyPlay-arm64\.apk/)
  assert.match(workflow, /OmyPlay-arm32\.apk/)
  assert.match(workflow, /release\.json/)
  assert.match(workflow, /applicationId: release\.applicationId/)
  assert.match(workflow, /download\/omy-play/)
  assert.doesNotMatch(workflow, /Otya-arm64\.apk|Otya-arm32\.apk|download\/otya-player/)
})

test('APK endpoint requires a verified Omy Play publication pointer and immutable manifest', () => {
  const route = read('src/app/apk/[file]/route.ts')
  assert.match(route, /const APPLICATION_ID = 'com\.otya\.omyplay'/)
  assert.match(route, /const PRODUCT_CODE = 'OMY_PLAY'/)
  assert.match(route, /validOmyPlayPointer/)
  assert.match(route, /validOmyPlayManifest/)
  assert.match(route, /LATEST_BUILD_INFO/)
  assert.match(route, /release\.json/)
  assert.match(route, /OmyPlay-arm64\.apk/)
  assert.match(route, /OmyPlay-arm32\.apk/)
  assert.match(route, /No approved Omy Play release is available/)
  assert.match(route, /application\/vnd\.android\.package-archive/)
  assert.doesNotMatch(route, /Otya-arm64\.apk|Otya-arm32\.apk|petersmartlink\.com/)
})

test('public latest metadata and Android package schema agree on Omy Play', () => {
  const layout = read('src/app/layout.tsx')
  const downloadPage = read('src/app/download/otya-player/DownloadButtons.tsx')
  const canonicalPage = read('src/app/download/omy-play/page.tsx')
  assert.match(layout, /identifier: 'com\.otya\.omyplay'/)
  assert.match(canonicalPage, /canonical: 'https:\/\/otya\.site\/download\/omy-play'/)
  assert.match(downloadPage, /release\.published===false/)
  assert.match(downloadPage, /No public Android release is available yet/)
  assert.match(downloadPage, /Choose your Android build/)
  assert.match(downloadPage, /Omy Play will not guess/)
  assert.match(downloadPage, /download\('arm64'\)/)
  assert.match(downloadPage, /download\('arm32'\)/)
})

test('missing or legacy release metadata never gets presented as a new Omy Play APK', () => {
  const latest = read('src/app/latest/route.ts')
  const route = read('src/app/apk/[file]/route.ts')
  assert.match(latest, /function noPublicRelease/)
  assert.match(latest, /applicationId: APPLICATION_ID/)
  assert.match(latest, /published: false/)
  assert.match(route, /if \(!validOmyPlayPointer\(latest\)\) return notPublished\(\)/)
  assert.match(route, /if \(!validOmyPlayManifest\(manifest, resolvedTag\)\) return notPublished\(\)/)
})

test('Omy Play App Distribution never reuses the legacy Otya Player Firebase project', () => {
  const workflow = read('src/release-workflow.mjs')
  const wrangler = read('wrangler.toml')
  assert.match(wrangler, /OMY_PLAY_FIREBASE_PROJECT_ID = "omyplay-otya-prod"/)
  assert.match(wrangler, /OMY_PLAY_FIREBASE_PROJECT_NUMBER = "181484175543"/)
  assert.match(wrangler, /OMY_PLAY_FIREBASE_ANDROID_APP_ID = "1:181484175543:android:b7eae0234df6eb7e370d32"/)
  assert.match(workflow, /OMY_PLAY_FIREBASE_SERVICE_ACCOUNT_JSON/)
  assert.match(workflow, /OMY_PLAY_FIREBASE_PROJECT_NUMBER/)
  assert.match(workflow, /OMY_PLAY_FIREBASE_ANDROID_APP_ID/)
  assert.match(workflow, /mirror approved Omy Play release to its dedicated Firebase project/)
  assert.doesNotMatch(workflow, /mirrorApkToFirebaseAppDistribution\(\s*this\.env/)
})
