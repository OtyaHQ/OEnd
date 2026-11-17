// app/api/admin/release/route.ts
//
// Production releases are intentionally NOT writable through this generic
// metadata endpoint. The canonical release path is the signed GitHub release
// workflow, which uploads verified APKs to R2 and starts the bound
// OtyaReleaseWorkflow. Keeping this route authenticated but fail-closed avoids
// a second, weaker release authority inside the Admin UI.

import { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { errorJson } from '@/lib/response'
import { verifyAdminSession } from '@/lib/admin_auth'
import { PUBLIC_URLS } from '@/lib/public-urls'

function corsHeaders(request?: Request) {
  const origin = request?.headers.get('Origin') ?? ''
  const allowed = new Set([PUBLIC_URLS.primary, PUBLIC_URLS.api, PUBLIC_URLS.space].map(value => new URL(value).origin))
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  })
  if (origin && allowed.has(origin)) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

export async function POST(req: NextRequest) {
  const { env } = await getCloudflareContext({ async: true })
  const recordEnv = env as Record<string, unknown>
  if (!await verifyAdminSession(req, recordEnv)) return errorJson('Unauthorized', 401)

  return errorJson(
    'Direct release metadata publishing is disabled. Use the verified GitHub release workflow so APK artifacts, version ordering, R2 publication and release metadata are validated together.',
    409,
  )
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}
