// app/api/bookmarks/route.ts
// Cloud sync of bookmarked media positions for resume playback.
// Requires JWT auth (Authorization: Bearer <token>).

import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { verifyJwtViaService, extractBearerToken } from '@/lib/auth-service'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'
import { PUBLIC_URLS } from '@/lib/public-urls'

function corsHeaders(request?: Request) {
  const origin = request?.headers.get('Origin') ?? ''
  const allowed = new Set([PUBLIC_URLS.primary, PUBLIC_URLS.api, PUBLIC_URLS.space].map(value => new URL(value).origin))
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  })
  if (origin && allowed.has(origin)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

export async function GET(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const token = extractBearerToken(req.headers.get('Authorization'))
  if (!token) return errorJson('Authorization header required', 401)
  const jwtResult = await verifyJwtViaService(env as Record<string, unknown>, token)
  if (!jwtResult.ok) return errorJson(jwtResult.error ?? 'Unauthorized', 401)

  const db = getDB(env as Record<string, unknown>)
  const { results } = await db.prepare(
    'SELECT * FROM bookmarks WHERE user_id = ? ORDER BY updated_at DESC'
  ).bind(jwtResult.user_id!).all()
  return secureJson({ bookmarks: results, ts: Date.now() })
}

export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const token = extractBearerToken(req.headers.get('Authorization'))
  if (!token) return errorJson('Authorization header required', 401)
  const jwtResult = await verifyJwtViaService(env as Record<string, unknown>, token)
  if (!jwtResult.ok) return errorJson(jwtResult.error ?? 'Unauthorized', 401)

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return errorJson('Invalid JSON body', 400) }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const mediaId = typeof body.media_id === 'string' ? body.media_id.trim() : ''
  const positionMs = Number(body.position_ms)
  if (!id || !mediaId) return errorJson('id and media_id are required', 400)
  if (!Number.isFinite(positionMs)) return errorJson('position_ms is required and must be a number', 400)

  const filePath = typeof body.file_path === 'string' ? body.file_path.slice(0, 2048) : null
  const durationRaw = Number(body.duration_ms)
  const durationMs = Number.isFinite(durationRaw) ? Math.max(0, Math.trunc(durationRaw)) : null
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 500) : null

  const db  = getDB(env as Record<string, unknown>)
  const now = new Date().toISOString()
  await db.prepare(`
    INSERT INTO bookmarks (id, user_id, media_id, file_path, position_ms, duration_ms, title, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      media_id    = excluded.media_id,
      file_path   = excluded.file_path,
      position_ms = excluded.position_ms,
      duration_ms = excluded.duration_ms,
      title       = excluded.title,
      updated_at  = excluded.updated_at
  `).bind(
    id,
    jwtResult.user_id!,
    mediaId,
    filePath,
    Math.max(0, Math.trunc(positionMs)),
    durationMs,
    title,
    now,
  ).run()

  return secureJson({ ok: true, ts: Date.now() })
}

export async function DELETE(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const token = extractBearerToken(req.headers.get('Authorization'))
  if (!token) return errorJson('Authorization header required', 401)
  const jwtResult = await verifyJwtViaService(env as Record<string, unknown>, token)
  if (!jwtResult.ok) return errorJson(jwtResult.error ?? 'Unauthorized', 401)

  let id = req.nextUrl.searchParams.get('id')?.trim() ?? ''
  if (!id) {
    try {
      const body = await req.json() as Record<string, unknown>
      id = typeof body.id === 'string' ? body.id.trim() : ''
    } catch { /* query-string form needs no body */ }
  }
  if (!id) return errorJson('id is required', 400)

  const db = getDB(env as Record<string, unknown>)
  await db.prepare('DELETE FROM bookmarks WHERE id = ? AND user_id = ?')
    .bind(id, jwtResult.user_id!)
    .run()
  return secureJson({ ok: true, ts: Date.now() })
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}
