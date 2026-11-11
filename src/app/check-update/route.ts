import { PUBLIC_URLS } from '@/lib/public-urls'
import { NextRequest, NextResponse } from 'next/server'
import { GET as getLatest } from '../latest/route'

// Backward-compatible adapter for older Android builds that still call
// `/check-update`. `/latest` owns release lookup/cache/storage logic.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {}
}

export async function GET(req: NextRequest) {
  const latest = await getLatest(req)
  if (!latest.ok) {
    return new NextResponse(await latest.text(), {
      status: latest.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': latest.headers.get('Content-Type') ?? 'application/json',
        'Cache-Control': latest.headers.get('Cache-Control') ?? 'no-store',
      },
    })
  }

  let data: Record<string, unknown>
  try {
    data = asRecord(await latest.json())
  } catch {
    return NextResponse.json(
      { error: 'Version info is malformed' },
      { status: 502, headers: CORS_HEADERS },
    )
  }

  const downloads = asRecord(data.downloads)
  const downloadUrl =
    (typeof downloads.auto === 'string' && downloads.auto) ||
    (typeof downloads.arm64 === 'string' && downloads.arm64) ||
    `${PUBLIC_URLS.primary}/download/otya-player`

  return NextResponse.json(
    {
      versionCode: Number(data.versionCode ?? 0),
      version: typeof data.version === 'string' ? data.version : '',
      changelog: typeof data.changelog === 'string'
        ? data.changelog
        : 'Bug fixes and improvements.',
      force_update: Boolean(data.force_update),
      download_url: downloadUrl,
    },
    {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': latest.headers.get('Cache-Control') ??
          'public, max-age=300, stale-while-revalidate=60',
      },
    },
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}
