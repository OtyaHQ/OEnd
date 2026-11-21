import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
const read = path => readFileSync(path, 'utf8')
test('public Otya surfaces and Omy Play Android download naming stay canonical', () => {
  const apk=read('src/app/apk/[file]/route.ts'), page=read('src/app/download/omy-play/page.tsx'), client=read('src/app/download/omy-play/DownloadButtons.tsx'), shell=read('src/components/OtyaSpaceChrome.tsx'), router=read('src/production-router.mjs')
  assert.match(apk,/Otya-arm64\.apk/)
  assert.match(apk,/Otya-arm32\.apk/)
  assert.doesNotMatch(apk,/OtyaPlayer/)
  assert.match(page,/title: 'Download Omy Play for Android'/)
  assert.match(page,/canonical: 'https:\/\/otya\.site\/download\/omy-play'/)
  assert.match(client,/Choose your Android build/)
  assert.match(client,/Omy Play/)
  assert.match(router,/url\.pathname === '\/download\/otya-player'/)
  assert.match(router,/redirectToHost\(url, APP_HOST, '\/download\/omy-play', 308\)/)
  assert.doesNotMatch(shell,/label: 'Next'/)
  assert.match(shell,/>Otya<\/div><div className="text-sm otya-muted">Space<\/div>/)
  assert.match(shell,/aria-label="Otya Space home"/)
  assert.doesNotMatch(shell,/Otya AI/)
})
