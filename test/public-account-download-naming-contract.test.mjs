import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = path => readFileSync(path, 'utf8')

test('public Otya surfaces and Android download naming stay canonical', () => {
  const apkRoute = read('src/app/apk/[file]/route.ts')
  const canonicalDownload = read('src/app/download/omy-play/page.tsx')
  const legacyCanonicalDownload = read('src/app/download/otya-player/page.tsx')
  const legacyDownload = read('src/app/download/otya/page.tsx')
  const spaceShell = read('src/components/OtyaSpaceChrome.tsx')

  assert.match(apkRoute, /OmyPlay-/)
  assert.match(apkRoute, /Omy Play release/)
  assert.match(apkRoute, /com\.otya\.omyplay/)
  assert.doesNotMatch(apkRoute, /Otya-arm64\.apk|Otya-arm32\.apk/)

  assert.doesNotMatch(canonicalDownload, /redirect\(/)
  assert.match(canonicalDownload, /title: 'Download Omy Play for Android'/)
  assert.match(canonicalDownload, /canonical: 'https:\/\/otya\.site\/download\/omy-play'/)
  assert.match(legacyCanonicalDownload, /redirect\('\/download\/omy-play'\)/)
  assert.match(legacyDownload, /redirect\('\/download\/omy-play'\)/)

  assert.doesNotMatch(spaceShell, /label: 'Next'/)
  assert.match(spaceShell, />Otya<\/div><div className="text-sm otya-muted">Space<\/div>/)
  assert.match(spaceShell, /aria-label="Otya Space home"/)
  assert.doesNotMatch(spaceShell, /Otya AI/)
})
