import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export const dynamic = 'force-dynamic'

type ServiceBinding = { fetch(request: Request): Promise<Response> }

const ALLOWED_PATHS = new Set(['health', 'latest', 'apk/arm64', 'apk/arm32'])

function json(data: unknown, status: number) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

/**
 * Same-origin, read-only gateway to the private Omy Play API.
 * Only schema health, latest-release metadata and the two published APK download paths
 * are exposed. The Worker remains private and owns release authorization.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const url = new URL(request.url)
    const origin = request.headers.get('origin')
    const fetchSite = request.headers.get('sec-fetch-site')
    if ((origin && origin !== url.origin)
      || (fetchSite && !['same-origin', 'same-site', 'none'].includes(fetchSite))) {
      return json({ error: 'same_origin_required' }, 403)
    }

    const { path = [] } = await context.params
    if (!Array.isArray(path)
      || path.length === 0
      || path.some(part => !part || part === '.' || part === '..' || part.includes('/') || part.includes(String.fromCharCode(92)))) {
      return json({ error: 'invalid_omy_play_path' }, 404)
    }
    const upstreamPath = path.join('/')
    if (!ALLOWED_PATHS.has(upstreamPath)) return json({ error: 'not_found' }, 404)

    const { env } = await getCloudflareContext({ async: true })
    const binding = (env as Record<string, unknown>).OMY_PLAY_API as ServiceBinding | undefined
    if (!binding?.fetch) return json({ error: 'omy_play_unavailable' }, 503)

    const target = new URL('/' + upstreamPath + url.search, 'https://omy-play-service')
    const upstream = await binding.fetch(new Request(target, {
      method: 'GET',
      headers: { Accept: request.headers.get('accept') ?? '*/*' },
      redirect: 'manual',
      signal: AbortSignal.timeout(20000),
    }))

    const headers = new Headers()
    for (const name of ['content-type', 'content-disposition', 'content-length', 'etag', 'retry-after', 'x-request-id']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Cache-Control', upstream.headers.get('cache-control') ?? 'private, no-store')
    return new NextResponse(upstream.body, { status: upstream.status, headers })
  } catch (error) {
    console.error('[omy-play-gateway]', (error as Error)?.message)
    return json({ error: 'omy_play_unavailable' }, 503)
  }
}
