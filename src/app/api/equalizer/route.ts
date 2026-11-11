// app/api/equalizer/route.ts
// Cloud sync of user's equalizer presets. Requires JWT auth.

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

interface EqBand {
  freq: number
  gain: number
}

async function requireUser(req: NextRequest, env: Record<string, unknown>) {
  const token = extractBearerToken(req.headers.get('Authorization'))
  if (!token) return { error: errorJson('Authorization header required', 401) }
  const jwtResult = await verifyJwtViaService(env, token)
  if (!jwtResult.ok || !jwtResult.user_id) {
    return { error: errorJson(jwtResult.error ?? 'Unauthorized', 401) }
  }
  return { userId: jwtResult.user_id }
}

export async function GET(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const auth = await requireUser(req, env as Record<string, unknown>)
  if (auth.error) return auth.error

  const db = getDB(env as Record<string, unknown>)
  const { results } = await db.prepare(
    'SELECT * FROM eq_presets WHERE user_id = ? ORDER BY is_default DESC, created_at DESC'
  ).bind(auth.userId!).all<{
    id: string; user_id: string; preset_name: string; bands: string; is_default: number; created_at: string
  }>()

  const presets = results.map(row => ({
    ...row,
    bands: (() => {
      try { return JSON.parse(row.bands) as EqBand[] }
      catch { return [] }
    })(),
  }))
  return secureJson({ presets, ts: Date.now() })
}

export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const auth = await requireUser(req, env as Record<string, unknown>)
  if (auth.error) return auth.error

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> }
  catch { return errorJson('Invalid JSON body', 400) }

  const id = typeof body.id === 'string' ? body.id.trim() : ''
  const presetName = typeof body.preset_name === 'string' ? body.preset_name.trim().slice(0, 120) : ''
  const bands = body.bands as EqBand[] | undefined
  if (!id || !presetName) return errorJson('id and preset_name are required', 400)
  if (!Array.isArray(bands)) return errorJson('bands must be an array of { freq, gain } objects', 400)

  for (const band of bands) {
    if (!Number.isFinite(band?.freq) || !Number.isFinite(band?.gain)) {
      return errorJson('Each band must have numeric freq and gain fields', 400)
    }
  }

  const db = getDB(env as Record<string, unknown>)
  const isDefault = body.is_default ? 1 : 0
  const now = new Date().toISOString()
  if (isDefault) {
    await db.prepare('UPDATE eq_presets SET is_default = 0 WHERE user_id = ?')
      .bind(auth.userId!)
      .run()
  }

  await db.prepare(`
    INSERT INTO eq_presets (id, user_id, preset_name, bands, is_default, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      preset_name = excluded.preset_name,
      bands       = excluded.bands,
      is_default  = excluded.is_default
  `).bind(id, auth.userId!, presetName, JSON.stringify(bands), isDefault, now).run()

  return secureJson({ ok: true, ts: Date.now() })
}

export async function DELETE(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const auth = await requireUser(req, env as Record<string, unknown>)
  if (auth.error) return auth.error

  let id = req.nextUrl.searchParams.get('id')?.trim() ?? ''
  if (!id) {
    try {
      const body = await req.json() as Record<string, unknown>
      id = typeof body.id === 'string' ? body.id.trim() : ''
    } catch { /* query-string form needs no body */ }
  }
  if (!id) return errorJson('id is required', 400)

  const db = getDB(env as Record<string, unknown>)
  await db.prepare('DELETE FROM eq_presets WHERE id = ? AND user_id = ?')
    .bind(id, auth.userId!)
    .run()
  return secureJson({ ok: true, ts: Date.now() })
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}
