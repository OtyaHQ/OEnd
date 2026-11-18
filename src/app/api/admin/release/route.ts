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

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://otya.site',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}
