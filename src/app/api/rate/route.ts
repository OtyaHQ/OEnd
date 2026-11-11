// app/api/rate/route.ts
// POST /api/rate
// Accepts star ratings from the Flutter app.
// If stars <= 2, queues AI feedback analysis via AI_QUEUE.
// user_id is extracted from JWT if present, otherwise null.

import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { verifyRequest } from '@/lib/auth'
import { dualAuth } from '@/lib/auth-service'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'
import { PUBLIC_URLS } from '@/lib/public-urls'

function corsHeaders(request?: Request) {
  const origin = request?.headers.get('Origin') ?? ''
  const allowed = new Set([PUBLIC_URLS.primary, PUBLIC_URLS.api, PUBLIC_URLS.space].map(value => new URL(value).origin))
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Otya-Timestamp, X-Otya-Signature, X-Otya-Device-Id',
    'Vary': 'Origin',
  })
  if (origin && allowed.has(origin)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

// POST /api/rate — body: { device_id, app_version, version_code, stars, comment? }
export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })

  // ── 1. Dual auth: JWT first, then HMAC ───────────────────────────────────
  const auth = await dualAuth(req, env, verifyRequest)
  if (auth.mode === 'none') return errorJson(auth.error ?? 'Unauthorized', 401)

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return errorJson('Invalid JSON body', 400)
  }

  const { device_id, app_version, version_code, stars, comment } = body

  const starsNum = Number(stars)
  if (!stars || isNaN(starsNum) || starsNum < 1 || starsNum > 5) {
    return errorJson('stars must be 1–5', 400)
  }

  // Extract user_id from JWT if authenticated
  const userId = auth.mode === 'jwt' ? auth.user_id : null

  const db = getDB(env as Record<string, unknown>)

  // ── 3. Insert rating ──────────────────────────────────────────────────────
  const result = await db.prepare(`
    INSERT INTO ratings (device_id, user_id, app_version, version_code, stars, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    device_id    ?? null,
    userId,
    app_version  ?? null,
    version_code != null ? Number(version_code) : null,
    starsNum,
    comment ?? null,
  ).run()

  // ── 4. Queue AI feedback analysis for low ratings ─────────────────────────
  if (starsNum <= 2 && comment && typeof comment === 'string' && comment.trim().length > 0) {
    const ratingId = (result.meta as Record<string, unknown>)?.last_row_id as number | undefined
    const aiQueue  = (env as Record<string, unknown>).AI_QUEUE as { send(body: unknown): Promise<void> } | undefined

    if (aiQueue) {
      try {
        // Insert as feedback so it gets categorized
        const feedbackResult = await db.prepare(`
          INSERT INTO feedback (device_id, app_version, version_code, category, description)
          VALUES (?, ?, ?, 'complaint', ?)
        `).bind(
          device_id    ?? null,
          app_version  ?? null,
          version_code != null ? Number(version_code) : null,
          `[${starsNum}★ rating] ${comment.trim()}`,
        ).run()

        const feedbackId = (feedbackResult.meta as Record<string, unknown>)?.last_row_id as number | undefined
        if (feedbackId) {
          await aiQueue.send({
            type:        'categorize_feedback',
            feedbackId,
            description: `[${starsNum}★ rating] ${comment.trim()}`,
          })
        }
      } catch (e) {
        // Non-fatal — rating is already saved
        console.error('[rate] Failed to queue AI feedback analysis:', (e as Error)?.message)
      }
    }

    console.log(`[rate] Low rating (${starsNum}★) from device ${device_id ?? 'unknown'} — queued for analysis. ratingId: ${ratingId}`)
  }

  return secureJson({ ok: true, ts: Date.now() })
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS })
}
