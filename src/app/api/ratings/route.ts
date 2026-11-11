import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { verifyRequest } from '@/lib/auth'
import { dualAuth } from '@/lib/auth-service'
import { appCheckEnforced, verifyFirebaseAppCheck } from '@/lib/firebase_app_check'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'
import { PUBLIC_URLS } from '@/lib/public-urls'

function corsHeaders(request?: Request) {
  const origin = request?.headers.get('Origin') ?? ''
  const allowed = new Set([PUBLIC_URLS.primary, PUBLIC_URLS.api, PUBLIC_URLS.space].map(value => new URL(value).origin))
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Firebase-AppCheck, X-Otya-Device-Id',
    'Vary': 'Origin',
  })
  if (origin && allowed.has(origin)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text ? text.slice(0, max) : null
}

// POST /api/ratings — anonymous ratings are allowed because the in-app prompt
// can be shown before sign-in. App Check attests the app installation while a
// verified JWT may separately associate the rating with an OTYA account.
export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>
  const appCheck = await verifyFirebaseAppCheck(req, recordEnv)
  if (appCheckEnforced(recordEnv) && !appCheck.valid) {
    return errorJson('App attestation required', 401)
  }

  const auth = await dualAuth(req, env, verifyRequest)

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return errorJson('Invalid JSON body', 400)
  }

  const starsNum = Number(body.stars)
  if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
    return errorJson('stars must be an integer from 1 to 5', 400)
  }

  const versionNumber = Number(body.version_code)
  const versionCode = Number.isFinite(versionNumber)
    ? Math.max(0, Math.trunc(versionNumber))
    : null

  const userId = auth.mode === 'jwt' ? auth.user_id : null
  const db = getDB(recordEnv)
  await db.prepare(`
    INSERT INTO ratings (device_id, user_id, app_version, version_code, stars, comment)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    cleanText(body.device_id, 128),
    userId,
    cleanText(body.app_version, 64),
    versionCode,
    starsNum,
    cleanText(body.comment, 1000),
  ).run()

  return secureJson({
    ok: true,
    authenticated: auth.mode !== 'none',
    app_check: appCheck.valid ? 'valid' : appCheck.configured ? 'unverified' : 'not-configured',
    ts: Date.now(),
  })
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}
