import { writeFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import sharp from 'sharp'

// These four files are exact source-derived crops from the owner's supplied banner.
// The build vendors them locally and composes the Telegram/social card only from these crops.
const ASSETS = [
  {
    url: 'https://assets.otya.site/brand/otya/v4/otya-master-icon-512.webp',
    sha256: '977722e97ce4ebe6a1857c8fce31b04ac34ae35826aa413d4f1ac759cf731445',
    target: 'public/otya-app-icon.webp',
    width: 512,
    height: 512,
  },
  {
    url: 'https://assets.otya.site/brand/otya/v4/otya-master-lockup.webp',
    sha256: '0ae187720d31c2c1ac7e283634b4d236c9e59e8fcfbe07886eba481c558c2fef',
    target: 'public/otya-master-lockup.webp',
    width: 560,
    height: 179,
  },
  {
    url: 'https://assets.otya.site/brand/otya/v4/otya-product-strip.webp',
    sha256: '225189d3f807f5b60ff8858498bcd21ec0aef30f8deb6d14fbfaf7da2a011317',
    target: 'public/otya-product-strip.webp',
    width: 560,
    height: 100,
  },
  {
    url: 'https://assets.otya.site/brand/otya/v4/otya-company-footer.webp',
    sha256: 'c501f59665e87e9d4539a40730bbb5d9d5c81192fc90b43906f3f69f4c2b9fed',
    target: 'public/otya-company-footer.webp',
    width: 560,
    height: 85,
  },
]

const RETIRED_GENERATED_TARGETS = [
  'public/otya-mark-current.png',
  'public/android-chrome-192x192.png',
  'public/android-chrome-512x512.png',
  'public/apple-touch-icon.png',
  'public/favicon-16x16.png',
  'public/favicon-32x32.png',
  'public/web-app-manifest-192x192.png',
  'public/web-app-manifest-512x512.png',
]

async function fetchApprovedAsset(asset) {
  const response = await fetch(asset.url, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Could not fetch approved Otya artwork: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  const checksum = createHash('sha256').update(bytes).digest('hex')
  if (checksum !== asset.sha256) {
    throw new Error(`Approved Otya artwork checksum mismatch: ${asset.target}`)
  }
  const metadata = await sharp(bytes).metadata()
  if (metadata.format !== 'webp' || metadata.width !== asset.width || metadata.height !== asset.height) {
    throw new Error(`Approved Otya artwork dimensions/format mismatch: ${asset.target}`)
  }
  return { asset, bytes }
}

async function sync() {
  const downloaded = await Promise.all(ASSETS.map(fetchApprovedAsset))
  for (const { asset, bytes } of downloaded) {
    await writeFile(resolve(process.cwd(), asset.target), bytes)
  }

  // Remove retired generated names so stale builds cannot publish old icons.
  await Promise.all(
    RETIRED_GENERATED_TARGETS.map(target => rm(resolve(process.cwd(), target), { force: true })),
  )

  const byTarget = Object.fromEntries(downloaded.map(({ asset, bytes }) => [asset.target, bytes]))
  const lockup = await sharp(byTarget['public/otya-master-lockup.webp']).resize({ width: 950 }).toBuffer()
  const products = await sharp(byTarget['public/otya-product-strip.webp']).resize({ width: 950 }).toBuffer()
  const footer = await sharp(byTarget['public/otya-company-footer.webp']).resize({ width: 950 }).toBuffer()
  const canvas = Buffer.from('<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#FFFFFF"/></svg>')

  // Preserve the exact master lockup, product strip and company footer; no substitute lettering or invented iconography.
  await sharp(canvas)
    .composite([
      { input: lockup, left: 125, top: 0 },
      { input: products, left: 125, top: 310 },
      { input: footer, left: 125, top: 480 },
    ])
    .jpeg({ quality: 92 })
    .toFile(resolve(process.cwd(), 'public/otya-release-card.jpg'))

  console.log('Verified the approved Otya icon, master lockup, product strip and company footer.')
  console.log('Generated the release card exclusively from exact source-derived artwork crops.')
}

await sync()
