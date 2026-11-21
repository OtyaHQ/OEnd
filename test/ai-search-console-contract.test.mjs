import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('OTYA AI Search stays a private read-only owner Console tool', () => {
  const wrangler = read('ai-worker/wrangler.toml')
  const consoleTools = read('ai-worker/src/console-tools.mjs')
  const ownerConsole = read('ai-worker/src/owner-console.mjs')
  const entry = read('ai-worker/src/scheduled-entry.mjs')

  assert.match(wrangler, /\[\[ai_search\]\][\s\S]*binding\s*=\s*"AI_SEARCH"[\s\S]*instance_name\s*=\s*"o-knowledge"/)
  assert.match(consoleTools, /async function knowledgeSearch\(env, query\)/)
  assert.match(consoleTools, /env\.AI_SEARCH\.search\(/)
  assert.match(consoleTools, /'knowledge_search'/)
  assert.match(consoleTools, /No public search endpoint is exposed/)

  // The owner wrapper may add approval-gated write orchestration, but ordinary
  // Console reads still delegate to the established internal Console handler.
  assert.match(ownerConsole, /handleConsoleAdmin\(request, env\)/)
  assert.match(entry, /handleOwnerConsole\(request,runtimeEnv\)/)
  assert.doesNotMatch(entry, /\/api\/ai\/search/)
})
