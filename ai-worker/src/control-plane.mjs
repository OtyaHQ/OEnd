const CONFIG_KEY = 'app:remote-config'
const FIREBASE_SYNC_KEY = 'app:remote-config:firebase-sync'
const FIREBASE_CACHE_KEY = 'app:remote-config:firebase-cache-v1'

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

async function readJson(env, key) {
  if (!env.KV?.get) return null
  try {
    return await env.KV.get(key, 'json')
  } catch {
    return null
  }
}

export async function controlPlaneStatus(env) {
  const [configRaw, syncRaw, cacheRaw] = await Promise.all([
    readJson(env, CONFIG_KEY),
    readJson(env, FIREBASE_SYNC_KEY),
    readJson(env, FIREBASE_CACHE_KEY),
  ])

  const config = record(configRaw)
  const sync = record(syncRaw)
  const cache = record(cacheRaw)
  const cloudflareRevision = typeof config.revision === 'number' ? config.revision : null
  const firebaseRevision = typeof sync.revision === 'number'
    ? sync.revision
    : (typeof cache.revision === 'number' ? cache.revision : null)
  const firebaseConfigured = sync.configured === true
  const firebaseSynced = sync.synced === true
  const firebaseFreshEnough = firebaseRevision !== null
    && cloudflareRevision !== null
    && firebaseRevision >= cloudflareRevision

  return {
    cloudflare_revision: cloudflareRevision,
    firebase_remote_config: {
      configured: firebaseConfigured,
      synced: firebaseSynced,
      revision: firebaseRevision,
      client_source: firebaseSynced && firebaseFreshEnough
        ? 'firebase-remote-config'
        : 'cloudflare-fallback',
      last_sync_at: typeof sync.updatedAt === 'string' ? sync.updatedAt : null,
      cached_at: typeof cache.fetchedAtMs === 'number'
        ? new Date(cache.fetchedAtMs).toISOString()
        : null,
    },
    ownership: {
      safety_config: 'cloudflare',
      client_experiments: 'firebase-remote-config-with-cloudflare-fallback',
      push_transport: 'firebase-fcm',
      session_authority: 'oend-identity-cloudflare',
      otp_email: 'cloudflare-resend',
    },
  }
}
