// POST /api/notifications/reengage
// Admin-only dormant-device audit. Live marketing sends remain disabled until
// OTYA persists explicit marketing consent and unsubscribe state.

import { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'
import { verifyAdminSession } from '@/lib/admin_auth'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://otya.site',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>
  if (!await verifyAdminSession(req, recordEnv)) return errorJson('Unauthorized', 401)

  let body: Record<string, unknown> = {}
  try {
    const text = await req.text()
    if (text.trim()) body = JSON.parse(text) as Record<string, unknown>
  } catch {
    return errorJson('Invalid JSON body', 400)
  }

  const dryRun = body.dryRun === true || body.dry_run === true
  const db = getDB(recordEnv)
  const row = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM devices
    WHERE last_seen_at < datetime('now', '-30 days')
  `).first<{ count: number }>()
  const eligibleDormantDevices = row?.count ?? 0

  if (dryRun) {
    return secureJson({
      dryRun: true,
      sent: 0,
      eligibleDormantDevices,
      marketingEnabled: false,
      reason: 'Explicit marketing consent and unsubscribe state are not persisted.',
      ts: Date.now(),
    })
  }

  return errorJson(
    'Live re-engagement sending is disabled until explicit marketing consent and unsubscribe state are implemented.',
    409,
  )
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
