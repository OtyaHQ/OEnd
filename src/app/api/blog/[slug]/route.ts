/**
 * GET /api/blog/[slug]
 * Public endpoint — returns a single published blog post by slug.
 */

import { NextRequest } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { secureJson, errorJson } from '@/lib/response'
import { getDB } from '@/lib/d1'
import { PUBLIC_URLS } from '@/lib/public-urls'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  if (!slug) return errorJson('slug is required', 400)

  const { env } = await getCloudflareContext({ async: true })
  const db = getDB(env as Record<string, unknown>)

  try {
    const post = await db.prepare(
      'SELECT * FROM blog_posts WHERE slug = ? AND published = 1'
    ).bind(slug).first()

    if (!post) return errorJson('Post not found', 404)

    return secureJson({ post }, { cache: 'public, max-age=300' })
  } catch (err) {
    console.error('[blog/slug] D1 query failed:', err)
    return errorJson('Failed to load post', 500)
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = new Set([PUBLIC_URLS.primary, PUBLIC_URLS.api, PUBLIC_URLS.docs].map(value => new URL(value).origin))
  const headers = new Headers({
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  })
  if (origin && allowed.has(origin)) headers.set('Access-Control-Allow-Origin', origin)
  return new Response(null, { status: 204, headers })
}
