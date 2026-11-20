import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(`./${path}`, import.meta.url), 'utf8')
const failures = []
function requireMatch(label, source, pattern) { if (!pattern.test(source)) failures.push(label) }
function forbidMatch(label, source, pattern) { if (pattern.test(source)) failures.push(label) }

const core = read('wrangler.toml')
const auth = read('auth-worker/wrangler.toml')
const next = read('ai-worker/wrangler.toml')
const deploy = read('.github/workflows/deploy.yml')
const fcm = read('src/lib/fcm.ts')
const appCheck = read('src/lib/firebase_app_check.ts')
const googleWrapper = read('auth-worker/src/production-entrypoint.ts')
const appConfig = read('src/app/api/app-config/route.ts')
const clientConfig = read('src/lib/client_config.ts')
const musicPage = read('src/app/music/page.tsx')
const telegramProxy = read('src/app/api/auth/telegram/[...path]/route.ts')
const telegramCore = read('src/lib/telegram-bot.mjs')
const telegramReceiptMigration = read('migrations/0010_telegram_update_receipts.sql')
const telegramMini = read('auth-worker/src/telegram-miniapp.ts')

requireMatch('shared Worker must be oend', core, /^name\s*=\s*"oend"$/m)
requireMatch('oend workers.dev must be disabled', core, /^workers_dev\s*=\s*false$/m)
requireMatch('oend must redact query strings', core, /^redact_query_string\s*=\s*true$/m)
for (const hostname of ['otya.site', 'www.otya.site', 'docs.otya.site', 'status.otya.site', 'space.otya.site', 'api.otya.site']) requireMatch(`canonical Otya hostname ${hostname}`, core, new RegExp(`pattern\\s*=\\s*"${hostname.replaceAll('.', '\\.') }"`))
for (const binding of ['R2', 'KV', 'DB', 'ANALYTICS', 'OTYA_ANALYTICS', 'RATE_LIMITER', 'PUSH_QUEUE', 'AI_QUEUE', 'AUTH', 'AI_SUPPORT', 'OPOINT_API', 'OMY_PLAY_API', 'OTYA_RELEASE_WORKFLOW']) requireMatch(`oend binding ${binding}`, core, new RegExp(`(?:binding|name)\\s*=\\s*"${binding}"`))
requireMatch('oend Analytics Engine dataset', core, /^dataset\s*=\s*"oend-analytics"$/m)
requireMatch('compatibility OTYA Analytics Engine dataset remains bound during migration', core, /^dataset\s*=\s*"oend_system_analytics"$/m)
requireMatch('OEnd O service binding must target O', core, /binding\s*=\s*"AI_SUPPORT"[\s\S]*?service\s*=\s*"o"/m)
requireMatch('OEnd O queue must use canonical name', core, /binding\s*=\s*"AI_QUEUE"[\s\S]*?queue\s*=\s*"o-jobs"/m)
requireMatch('OEnd push queue must use canonical name', core, /binding\s*=\s*"PUSH_QUEUE"[\s\S]*?queue\s*=\s*"oend-push"/m)
requireMatch('release workflow must use canonical name', core, /name\s*=\s*"oend-release"[\s\S]*?binding\s*=\s*"OTYA_RELEASE_WORKFLOW"/m)
forbidMatch('release event consumer must stay detached until source handler lands', core, /\[\[queues\.consumers\]\][\s\S]*?queue\s*=\s*"oend-release-events"/m)
requireMatch('core deploy must pass the release-manifest secret from GitHub', deploy, /RELEASE_MANIFEST_HMAC_SECRET:\s*\$\{\{ secrets\.RELEASE_MANIFEST_HMAC_SECRET \}\}/)
requireMatch('core deploy must store the release-manifest secret in Cloudflare', deploy, /wrangler secret put RELEASE_MANIFEST_HMAC_SECRET/)

const router = read('src/production-router.mjs')
forbidMatch('retired petersmartlink hostnames must not return', router, /petersmartlink|LEGACY_HOST_REDIRECTS/i)
requireMatch('Core public website must use otya.site', core, /^WEBSITE_URL\s*=\s*"https:\/\/otya\.site"$/m)

requireMatch('physical v1 D1 name must remain unchanged during cutover', core, /^database_name\s*=\s*"otya-store-db"$/m)
requireMatch('Firebase project id must be otya-player', core, /^FIREBASE_PROJECT_ID\s*=\s*"otya-player"$/m)
requireMatch('Firebase project number must be verified', core, /^FIREBASE_PROJECT_NUMBER\s*=\s*"82776565585"$/m)
requireMatch('Firebase Android app id must be verified', core, /^FIREBASE_ANDROID_APP_ID\s*=\s*"1:82776565585:android:085cf9b4eecb76e9535570"$/m)
requireMatch('Android package must be verified', core, /^ANDROID_PACKAGE_NAME\s*=\s*"com\.otyaplayer\.app"$/m)
requireMatch('App Check production mode must remain monitor', core, /^FIREBASE_APP_CHECK_MODE\s*=\s*"monitor"$/m)
forbidMatch('App Check must not be pinned to enforce in Wrangler', core, /^FIREBASE_APP_CHECK_MODE\s*=\s*"enforce"$/m)

requireMatch('Telegram bot token uses Secrets Store on core', core, /\[\[secrets_store_secrets\]\][\s\S]*?binding\s*=\s*"TELEGRAM_BOT_TOKEN"[\s\S]*?secret_name\s*=\s*"TELEGRAM_BOT_TOKEN"/m)
requireMatch('Telegram webhook secret uses Secrets Store on core', core, /binding\s*=\s*"TELEGRAM_WEBHOOK_SECRET"[\s\S]*?secret_name\s*=\s*"TELEGRAM_WEBHOOK_SECRET"/m)
requireMatch('Telegram core reads Secrets Store values with get()', telegramCore, /TELEGRAM_BOT_TOKEN[\s\S]*?\.get/)
requireMatch('Telegram webhook validates secret header', telegramCore, /X-Telegram-Bot-Api-Secret-Token/)
requireMatch('Telegram webhook atomically claims update_id', telegramCore, /INSERT OR IGNORE INTO telegram_update_receipts/)
requireMatch('Telegram webhook records completion status', telegramCore, /finishTelegramUpdate/)
requireMatch('Telegram webhook receipt migration owns update_id primary key', telegramReceiptMigration, /update_id INTEGER PRIMARY KEY/)
forbidMatch('Telegram webhook must not regress to racy KV GET then PUT dedupe', telegramCore, /telegram:update:/)
forbidMatch('Telegram bot token must not be treated as a raw committed string', telegramCore, /env\.TELEGRAM_BOT_TOKEN\s*\)/)

requireMatch('oid Worker name', auth, /^name\s*=\s*"oid"$/m)
requireMatch('OID must use Mini App production wrapper', auth, /^main\s*=\s*"src\/production-entrypoint-miniapp\.ts"$/m)
requireMatch('OID workers.dev must be disabled', auth, /^workers_dev\s*=\s*false$/m)
requireMatch('OID must redact query strings', auth, /^redact_query_string\s*=\s*true$/m)
requireMatch('OID live analytics binding', auth, /^binding\s*=\s*"ANALYTICS"$/m)
requireMatch('oid live analytics dataset', auth, /^dataset\s*=\s*"oid-analytics"$/m)
requireMatch('Android Google client id must be verified', auth, /^GOOGLE_CLIENT_ID\s*=\s*"82776565585-77b1t8epvmn3mpdvstdg1rtprlju4suv\.apps\.googleusercontent\.com"$/m)
requireMatch('Web Google client id must be verified', auth, /^GOOGLE_WEB_CLIENT_ID\s*=\s*"82776565585-obr8k53b8n6djsggissv8qne81cm3u5u\.apps\.googleusercontent\.com"$/m)
requireMatch('OID Firebase project id', auth, /^FIREBASE_PROJECT_ID\s*=\s*"otya-player"$/m)
requireMatch('Telegram redirect must match live canonical API callback', auth, /^TELEGRAM_LOGIN_REDIRECT_URI\s*=\s*"https:\/\/otya\.site\/api\/auth\/telegram\/callback"$/m)
requireMatch('Telegram Mini App auth uses purpose-specific Secrets Store alias', auth, /binding\s*=\s*"TELEGRAM_MINIAPP_BOT_TOKEN"[\s\S]*?secret_name\s*=\s*"TELEGRAM_BOT_TOKEN"/m)
requireMatch('Telegram Mini App derives WebAppData HMAC', telegramMini, /WebAppData/)
requireMatch('Telegram Mini App validates auth_date freshness', telegramMini, /MAX_AGE_SECONDS/)
requireMatch('Telegram Mini App uses numeric Telegram ID', telegramMini, /Number\.isSafeInteger\(user\.id\)/)
requireMatch('Telegram public callback must proxy to private auth service', telegramProxy, /PUBLIC_PREFIX\s*=\s*'\/api\/auth\/telegram\/'/)
requireMatch('Telegram public callback must preserve private auth route', telegramProxy, /AUTH_PREFIX\s*=\s*'\/auth\/telegram\/'/)
requireMatch('Telegram public callback must use AUTH binding', telegramProxy, /\.AUTH as AuthService/)
forbidMatch('Cloudflare EMAIL binding must not return to auth Wrangler', auth, /\[\[send_email\]\]|binding\s*=\s*"EMAIL"/i)
requireMatch('production Google wrapper must support web audience', googleWrapper, /GOOGLE_WEB_CLIENT_ID/)
requireMatch('production Google wrapper must reject unconfigured audiences', googleWrapper, /configuredGoogleAudiences/)

requireMatch('Next Worker must be o', next, /^name\s*=\s*"o"$/m)
requireMatch('O workers.dev must be disabled', next, /^workers_dev\s*=\s*false$/m)
requireMatch('O must redact query strings', next, /^redact_query_string\s*=\s*true$/m)
forbidMatch('Next must not own public push queue binding', next, /binding\s*=\s*"PUSH_QUEUE"/)
forbidMatch('Next must not own canonical public push queue', next, /queue\s*=\s*"oend-push"/)
requireMatch('O jobs queue canonical name', next, /\[\[queues\.consumers\]\][\s\S]*?queue\s*=\s*"o-jobs"/m)
requireMatch('O live analytics binding', next, /^binding\s*=\s*"ANALYTICS"$/m)
requireMatch('Next live analytics dataset', next, /^dataset\s*=\s*"o-analytics"$/m)
requireMatch('O Browser Run binding', next, /^\[browser\]\s*\nbinding\s*=\s*"BROWSER"$/m)
requireMatch('O AI Search binding', next, /\[\[ai_search\]\][\s\S]*?binding\s*=\s*"AI_SEARCH"[\s\S]*?instance_name\s*=\s*"o-knowledge"/m)
requireMatch('O gateway id must use canonical name', next, /^AI_GATEWAY_ID\s*=\s*"o-gateway"$/m)
requireMatch('owner assistant product name must use O', next, /^APP_NAME\s*=\s*"O"$/m)
requireMatch('Next guest model remains low-cost default', next, /^AI_GUEST_MODEL\s*=\s*"llama-fast"$/m)
requireMatch('Next physical v1 D1 name must remain unchanged during cutover', next, /^database_name\s*=\s*"otya-store-db"$/m)
requireMatch('Next Gmail OAuth must use the verified Web client id', next, /^GMAIL_GOOGLE_CLIENT_ID\s*=\s*"82776565585-obr8k53b8n6djsggissv8qne81cm3u5u\.apps\.googleusercontent\.com"$/m)
forbidMatch('Next Gmail OAuth must not use the Android client id', next, /^GMAIL_GOOGLE_CLIENT_ID\s*=\s*"82776565585-77b1t8epvmn3mpdvstdg1rtprlju4suv\.apps\.googleusercontent\.com"$/m)

requireMatch('FCM must use HTTP v1', fcm, /https:\/\/fcm\.googleapis\.com\/v1\/projects\/\$\{projectId\}\/messages:send/)
forbidMatch('Legacy FCM endpoint is forbidden', fcm, /fcm\.googleapis\.com\/fcm\/send/)
requireMatch('App Check implementation must support monitor/enforce switch', appCheck, /FIREBASE_APP_CHECK_MODE/)

forbidMatch('Online Music must not return to canonical app config', appConfig, /onlineMusic\s*:\s*true/)
requireMatch('Search provider priority must remain local/help only', appConfig, /providerPriority:\s*\['local',\s*'help'\]/)
forbidMatch('Firebase client config must not re-enable Online Music', clientConfig, /'onlineMusic'/)
forbidMatch('Music web page must not call Jamendo', musicPage, /api\/music\/jamendo|JAMENDO_/i)
forbidMatch('Music web page must not embed remote stream playback', musicPage, /streamUrl|<audio/i)
requireMatch('Music web page must describe local-first scope', musicPage, /Local-first music/)

const scanned = [
  core,
  auth,
  next,
  fcm,
  appCheck,
  googleWrapper,
  appConfig,
  clientConfig,
  musicPage,
  telegramProxy,
  telegramCore,
  telegramReceiptMigration,
  telegramMini,
].join('\n')
forbidMatch('Firebase Admin private key material must not be committed', scanned, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/)
forbidMatch('Resend API key values must not be committed', scanned, /\bre_[A-Za-z0-9_-]{20,}\b/)
forbidMatch('Jamendo credentials must not be committed after provider retirement', scanned, /JAMENDO_CLIENT_SECRET\s*=|JAMENDO_CLIENT_ID\s*=/)

if (failures.length) {
  console.error('Otya production configuration validation failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}
console.log('Otya production configuration validation passed.')
