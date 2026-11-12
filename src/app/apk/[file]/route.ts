import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getDB } from '@/lib/d1'

const APPLICATION_ID = 'com.otya.omyplay'
const PRODUCT_CODE = 'OMY_PLAY'
const LEGACY_VERSION_RE = /^\d+\.\d+\.\d+$/
const BUILD_TAG_RE = /^v\d+\.\d+\.\d+\+[1-9]\d*$/
const DOWNLOAD_RATE_WINDOW_SECONDS = 60
const APK_CONTENT_TYPE = 'application/vnd.android.package-archive'

type DownloadKV = {
  get(key: string): Promise<string | null>
}

type DownloadRateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>
}

type R2Object = {
  body: ReadableStream
  size: number
  text(): Promise<string>
}

type ReleasePointer = {
  applicationId?: string
  productCode?: string
  tag?: string
  version?: string
}

type ReleaseManifest = {
  applicationId?: string
  productCode?: string
  tag?: string
  version?: string
  versionCode?: number
  arm64Key?: string
  arm32Key?: string
}

function requestIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? ''
  ).trim().slice(0, 64)
}

async function enforceDownloadAbuseControls(
  req: NextRequest,
  env: Record<string, unknown>,
): Promise<NextResponse | null> {
  const ip = requestIp(req)
  if (!ip) return null

  const kv = env.KV as DownloadKV | undefined
  if (kv?.get) {
    try {
      if (await kv.get('blocked:' + ip) !== null) {
        return new NextResponse('Forbidden', {
          status: 403,
          headers: { 'Cache-Control': 'no-store' },
        })
      }
    } catch (error) {
      console.error('[download] IP block check failed:', (error as Error)?.message)
    }
  }

  const limiter = env.RATE_LIMITER as DownloadRateLimiter | undefined
  if (limiter?.limit) {
    try {
      const result = await limiter.limit({ key: 'download:' + ip })
      if (!result.success) {
        return new NextResponse('Too many download requests. Please try again shortly.', {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(DOWNLOAD_RATE_WINDOW_SECONDS),
          },
        })
      }
    } catch (error) {
      console.error('[download] RATE_LIMITER failed:', (error as Error)?.message)
    }
  }

  return null
}

function notPublished() {
  return new NextResponse('No approved Omy Play release is available.', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function validOmyPlayPointer(value: unknown): value is ReleasePointer {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const pointer = value as ReleasePointer
  return pointer.applicationId === APPLICATION_ID
    && pointer.productCode === PRODUCT_CODE
    && typeof pointer.tag === 'string'
    && BUILD_TAG_RE.test(pointer.tag)
    && typeof pointer.version === 'string'
    && LEGACY_VERSION_RE.test(pointer.version)
}

function validOmyPlayManifest(value: unknown, tag: string): value is ReleaseManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const manifest = value as ReleaseManifest
  if (manifest.applicationId !== APPLICATION_ID || manifest.productCode !== PRODUCT_CODE) return false
  if (manifest.tag !== tag || !BUILD_TAG_RE.test(tag)) return false
  if (typeof manifest.version !== 'string' || !LEGACY_VERSION_RE.test(manifest.version)) return false

  const identity = tag.slice(1)
  const separator = identity.lastIndexOf('+')
  if (separator <= 0 || identity.slice(0, separator) !== manifest.version) return false
  const tagBuild = Number(identity.slice(separator + 1))
  if (!Number.isSafeInteger(tagBuild) || tagBuild <= 0 || Number(manifest.versionCode) !== tagBuild) return false
  if (manifest.arm64Key !== 'releases/' + tag + '/OmyPlay-arm64.apk') return false
  if (manifest.arm32Key !== 'releases/' + tag + '/OmyPlay-arm32.apk') return false
  return true
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ file: string }> },
) {
  const { file } = await params
  if (file !== 'arm64' && file !== 'arm32') return new NextResponse('Not found', { status: 404 })

  const tag = req.nextUrl.searchParams.get('tag')
  const version = req.nextUrl.searchParams.get('v')
  if (tag && version) return new NextResponse('Choose either tag or version, not both', { status: 400 })
  if (tag && !BUILD_TAG_RE.test(tag)) return new NextResponse('Invalid release tag', { status: 400 })
  if (version && !LEGACY_VERSION_RE.test(version)) return new NextResponse('Invalid version', { status: 400 })

  try {
    const { env } = await getCloudflareContext()
    const runtimeEnv = env as Record<string, unknown>
    const denied = await enforceDownloadAbuseControls(req, runtimeEnv)
    if (denied) return denied

    const kv = runtimeEnv.KV as DownloadKV | undefined
    if (!kv?.get) return notPublished()

    // The current publication pointer must identify the Omy Play Android app.
    // The older Otya Player LATEST_BUILD_INFO key cannot authorize these downloads.
    const latestRaw = await kv.get('LATEST_BUILD_INFO')
    if (!latestRaw) return notPublished()

    let latest: unknown
    try {
      latest = JSON.parse(latestRaw)
    } catch {
      return notPublished()
    }
    if (!validOmyPlayPointer(latest)) return notPublished()

    let resolvedTag = tag
    if (version) {
      if (version !== latest.version) return notPublished()
      resolvedTag = latest.tag ?? null
    } else if (!resolvedTag) {
      resolvedTag = latest.tag
    }
    if (!resolvedTag) return notPublished()

    const r2 = runtimeEnv.R2 as {
      get(key: string): Promise<R2Object | null>
    } | undefined
    if (!r2) return new NextResponse('Storage is not available.', { status: 503 })

    // Every download, including "latest", resolves through an immutable
    // manifest that binds the exact tag and ABI objects to Omy Play's package ID.
    const manifestObject = await r2.get('releases/' + resolvedTag + '/release.json')
    if (!manifestObject) return notPublished()

    let manifest: unknown
    try {
      manifest = JSON.parse(await manifestObject.text())
    } catch {
      return notPublished()
    }
    if (!validOmyPlayManifest(manifest, resolvedTag)) return notPublished()

    const key = file === 'arm64' ? manifest.arm64Key : manifest.arm32Key
    const object = await r2.get(key as string)
    if (!object || object.size <= 0) return notPublished()

    try {
      const db = getDB(runtimeEnv)
      await db.prepare(
        'INSERT INTO downloads (abi, version, ip, user_agent) VALUES (?, ?, ?, ?)',
      ).bind(
        file,
        resolvedTag,
        requestIp(req),
        (req.headers.get('user-agent') ?? '').slice(0, 250),
      ).run()
    } catch { /* download telemetry is non-fatal */ }

    const filename = 'OmyPlay-' + file + '.apk'
    const headers = new Headers()
    headers.set('Content-Type', APK_CONTENT_TYPE)
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('Content-Disposition', 'attachment; filename="' + filename + '"')
    headers.set('Content-Length', String(object.size))
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    headers.set('Access-Control-Allow-Origin', '*')

    return new NextResponse(object.body, { headers })
  } catch {
    return new NextResponse('Download failed. Try again.', { status: 500 })
  }
}
