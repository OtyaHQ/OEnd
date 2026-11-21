import { writeFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import sharp from 'sharp'

// Master artwork and each product icon are exact crops from the owner's supplied banner.
// The original product-strip crop is retained in R2 for reference only: its labels predate
// the current product names, so public cards use the individual exact icon crops instead.
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
    sha256: 'f9bff0511c552a13bb90ac50428caf1c01911ffa9835f5b06b055517f681c3b2',
    target: 'public/otya-master-lockup.webp',
    width: 560,
    height: 208,
  },
  {
    url: 'https://assets.otya.site/brand/otya/v4/otya-company-footer.webp',
    sha256: 'c501f59665e87e9d4539a40730bbb5d9d5c81192fc90b43906f3f69f4c2b9fed',
    target: 'public/otya-company-footer.webp',
    width: 560,
    height: 85,
  },
  {
    url: 'https://assets.otya.site/brand/otya/v4/icons/opoint.webp',
    sha256: '2579c511ba5ee518eb1a582d95c236648621e2d46218c91e9f5a483b8b450d9a',
    target: 'public/otya-product-opoint.webp',
    width: 150,
    height: 140,
  },
  {
    url: 'https://assets.otya.site/brand/otya/v4/icons/omy-play.webp',
    sha256: '64a1fd216c4304ddd2d59361532cdc358836e328a562d0d3c1a87d22854c0d27',
    target: 'public/otya-product-omy-play.webp',
    width: 150,
    height: 140,
  },
  {
    url: 'https://assets.otya.site/brand/otya/v4/icons/otya-os.webp',
    sha256: 'a4d8bb1c245d7f0b4413e2bcff9d1d2e25eecbdd7ab0ff376046343c0067667a',
    target: 'public/otya-product-otya-os.webp',
    width: 155,
    height: 140,
  },
  {
    url: 'https://assets.otya.site/brand/otya/v4/icons/ohub.webp',
    sha256: '7dd43b6aa9f6a5a4d1560c1fa02934b20150630539dbe45d03cce790f86d1bef',
    target: 'public/otya-product-ohub.webp',
    width: 155,
    height: 140,
  },
  {
    url: 'https://assets.otya.site/brand/otya/v4/icons/oid.webp',
    sha256: '73f6e19997cbf28f65380ec9d6b25a5cdd27c34c3c8ee0fde0981fe082f0089e',
    target: 'public/otya-product-oid.webp',
    width: 155,
    height: 140,
  },
]

const RETIRED_GENERATED_TARGETS = [
  'public/otya-mark-current.png',
  'public/otya-product-strip.webp',
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

  await Promise.all(
    RETIRED_GENERATED_TARGETS.map(target => rm(resolve(process.cwd(), target), { force: true })),
  )

  const byTarget = Object.fromEntries(downloaded.map(({ asset, bytes }) => [asset.target, bytes]))
  const lockup = await sharp(byTarget['public/otya-master-lockup.webp']).resize({ width: 720 }).toBuffer()
  const footer = await sharp(byTarget['public/otya-company-footer.webp']).resize({ width: 720 }).toBuffer()
  const productCards = [
    { file: 'public/otya-product-opoint.webp', center: 150 },
    { file: 'public/otya-product-omy-play.webp', center: 375 },
    { file: 'public/otya-product-otya-os.webp', center: 600 },
    { file: 'public/otya-product-ohub.webp', center: 825 },
    { file: 'public/otya-product-oid.webp', center: 1050 },
  ]
  const productImages = await Promise.all(productCards.map(async product => ({
    input: await sharp(byTarget[product.file]).resize({ width: 68, height: 64, fit: 'contain', background: '#FFFFFF' }).toBuffer(),
    left: product.center - 34,
    top: 330,
  })))
  const canvas = Buffer.from('<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#FFFFFF"/></svg>')

  // The master wordmark and corporate footer remain exact image crops.
  // Product icons are exact crops; no replacement typography is added.
  await sharp(canvas)
    .composite([
      { input: lockup, left: 240, top: 0 },
      ...productImages,
      { input: footer, left: 240, top: 510 },
    ])
    .jpeg({ quality: 92 })
    .toFile(resolve(process.cwd(), 'public/otya-release-card.jpg'))

  console.log('Verified the approved Otya master icon, master lockup, company footer and five exact product icon crops.')
  console.log('Generated the release card from exact master and product artwork only; no retired labels or substitute wordmarks are used.')
}

await sync()
