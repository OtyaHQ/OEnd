import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { getKV, getR2 } from '@/lib/d1'

// GET /latest is the Omy Play release authority.
// Legacy Otya Player metadata is deliberately ignored: an APK must identify
// the exact Omy Play Android applicationId before it can be advertised.
const KV_CACHE_KEY = 'version:current'
const KV_TTL = 300
const APPLICATION_ID = 'com.otya.omyplay'
const PRODUCT_CODE = 'OMY_PLAY'
const DOWNLOAD_PAGE = 'https://otya.site/download/omy-play'
const ARM64_APK = 'https://otya.site/apk/arm64'
const ARM32_APK = 'https://otya.site/apk/arm32'
const BUILD_TAG_RE = /^v\d+\.\d+\.\d+\+[1-9]\d*$/
const VERSION_RE = /^\d+\.\d+\.\d+$/

type ReleaseMetadata = Record<string, unknown> & {
  applicationId?: string
  productCode?: string
  tag?: string
  version?: string
  versionCode?: number
  arm64?: string
  arm32?: string
}

function validOmyPlayRelease(value: unknown): value is ReleaseMetadata {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const info = value as ReleaseMetadata
  if (info.applicationId !== APPLICATION_ID || info.productCode !== PRODUCT_CODE) return false
  if (typeof info.tag !== 'string' || !BUILD_TAG_RE.test(info.tag)) return false
  if (typeof info.version !== 'string' || !VERSION_RE.test(info.version)) return false

  const identity = info.tag.slice(1)
  const separator = identity.lastIndexOf('+')
  if (separator <= 0) return false
  const tagVersion = identity.slice(0, separator)
  const tagBuild = Number(identity.slice(separator + 1))
  const versionCode = Number(info.versionCode)

  if (tagVersion !== info.version) return false
  if (!Number.isSafeInteger(tagBuild) || tagBuild <= 0 || versionCode !== tagBuild) return false
  if (info.arm64 !== \`releases/\${info.tag}/OmyPlay-arm64.apk\') return false
  if (info.arm32 !== \`releases/\${info.tag}/OmyPlay-arm32.apk\') return false
  return true
}

function releaseDownloads(tag: string) {
  return {
    arm64: ARM64_APK,
    arm32: ARM32_APK,
    auto: DOWNLOAD_PAGE,
    page: DOWNLOAD_PAGE,
    exactArm64: \`\${ARM64_APK}?tag=\${encodeURIComponent(tag)}\`,
    exactArm32: \`\${ARM32_APK}?tag=\${encodeURIComponent(tag)}\`,
  }
}

function publishedResponse(info: ReleaseMetadata, source: string, cache = false) {
  const data = {
    published: true,
    productCode: PRODUCT_CODE,
    applicationId: APPLICATION_ID,
    tag: info.tag,
    version: info.version,
    versionCode: info.versionCode,
    date: info.date ?? null,
    changelog: typeof info.changelog === 'string' ? info.changelog : '',
    minSdk: Number.isSafeInteger(Number(info.minSdk)) ? Number(info.minSdk) : 24,
    targetSdk: Number.isSafeInteger(Number(info.targetSdk)) ? Number(info.targetSdk) : 36,
    downloads: releaseDownloads(info.tag as string),
  }
  return new NextResponse(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cache ? \`public, max-age=\${KV_TTL}\` : 'no-store',
      'Access-Control-Allow-Origin': '*',
      'X-Source': source,
      'X-OTYA-Release-State': 'published',
    },
  })
}

function noPublicRelease() {
  return NextResponse.json(
    {
      published: false,
      productCode: PRODUCT_CODE,
      applicationId: APPLICATION_ID,
      version: null,
      versionCode: null,
      tag: null,
      date: null,
      changelog: '',
      minSdk: 24,
      targetSdk: 36,
      downloads: {
        arm64: ARM64_APK,
        arm32: ARM32_APK,
        auto: DOWNLOAD_PAGE,
        page: DOWNLOAD_PAGE,
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
        'X-OTYA-Release-State': 'pre-release',
      },
    },
  )
}

export async function GET(_req: NextRequest) {
  try {
    const { env } = await getCloudflareContext()
    const kv = getKV(env as Record<string, unknown>)
    const r2 = getR2(env as Record<string, unknown>)

    // 1. The atomic publication marker is trusted only when it names Omy Play.
    const latestRaw = await kv.get('LATEST_BUILD_INFO')
    if (latestRaw) {
      try {
        const info = JSON.parse(latestRaw) as unknown
        if (validOmyPlayRelease(info)) return publishedResponse(info, 'kv-latest-build-info')
      } catch { /* an invalid marker is not a published release */ }
    }

    // 2. A cached version document is also identity-checked; stale legacy
    // Otya Player cache entries must never be relabelled as Omy Play.
    const cached = await kv.get(KV_CACHE_KEY)
    if (cached) {
      try {
        const info = JSON.parse(cached) as unknown
        if (validOmyPlayRelease(info)) return publishedResponse(info, 'kv-cache', true)
      } catch { /* fall through to R2 */ }
    }

    // 3. R2 is the last source of truth. A legacy version.json without the
    // Omy Play applicationId remains unpublished on the new public surface.
    const object = await r2.get('version.json')
    if (!object) return noPublicRelease()

    const info = JSON.parse(await object.text()) as unknown
    if (!validOmyPlayRelease(info)) return noPublicRelease()

    const body = JSON.stringify({
      published: true,
      productCode: PRODUCT_CODE,
      applicationId: APPLICATION_ID,
      tag: info.tag,
      version: info.version,
      versionCode: info.versionCode,
      date: info.date ?? null,
      changelog: typeof info.changelog === 'string' ? info.changelog : '',
      minSdk: Number.isSafeInteger(Number(info.minSdk)) ? Number(info.minSdk) : 24,
      targetSdk: Number.isSafeInteger(Number(info.targetSdk)) ? Number(info.targetSdk) : 36,
      downloads: releaseDownloads(info.tag as string),
    })
    kv.put(KV_CACHE_KEY, body, { expirationTtl: KV_TTL }).catch(() => {})
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': \`public, max-age=\${KV_TTL}\`,
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS',
        'X-OTYA-Release-State': 'published',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch Omy Play release information' }, { status: 500 })
  }
}
