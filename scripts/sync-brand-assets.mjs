import { writeFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import sharp from 'sharp'

// Download the owner-approved Otya master icon from the public Cloudflare asset store.
// The website build vendors this exact source-derived asset locally for reliable rendering.
const SOURCE_URL = 'https://assets.otya.site/brand/otya/v4/otya-master-icon-512.webp'
const EXPECTED_SHA256 = 'b0bd89ca87e97f35d7f0a7c2045cbe5ba354d5ca1fbc27e184075934ac33ca7a'
const TARGET = 'public/otya-app-icon.webp'
const EXPECTED_WIDTH = 512
const EXPECTED_HEIGHT = 512
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

function readVp8Dimensions(bytes) {
  if (bytes.length < 30 || bytes.subarray(12, 16).toString('ascii') !== 'VP8 ') return null
  const marker = bytes.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), 20)
  if (marker < 0 || marker + 7 > bytes.length) return null
  return {
    width: bytes.readUInt16LE(marker + 3) & 0x3fff,
    height: bytes.readUInt16LE(marker + 5) & 0x3fff,
  }
}

function isCanonicalWebP(bytes) {
  if (bytes.length < 4096) return false
  if (bytes.subarray(0, 4).toString('ascii') !== 'RIFF') return false
  if (bytes.subarray(8, 12).toString('ascii') !== 'WEBP') return false
  const dimensions = readVp8Dimensions(bytes)
  return dimensions?.width === EXPECTED_WIDTH && dimensions?.height === EXPECTED_HEIGHT
}

async function sync() {
  const response = await fetch(SOURCE_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Could not fetch approved Otya icon: HTTP ${response.status}`)
  const bytes = Buffer.from(await response.arrayBuffer())
  if (createHash('sha256').update(bytes).digest('hex') !== EXPECTED_SHA256) {
    throw new Error('Downloaded Otya icon does not match the approved asset checksum.')
  }
  if (!isCanonicalWebP(bytes)) {
    throw new Error('Approved Otya icon is not the expected 512x512 WebP asset.')
  }
  await writeFile(resolve(process.cwd(), TARGET), bytes)

  // Remove retired generated names so stale builds cannot publish old icons.
  await Promise.all(
    RETIRED_GENERATED_TARGETS.map(target => rm(resolve(process.cwd(), target), { force: true })),
  )

  console.log(`Verified and vendored the owner-approved Otya icon at ${TARGET}.`)
  const card = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#08265C"/>
    <rect x="72" y="70" width="64" height="5" rx="2" fill="#00BDEB"/>
    <g fill="#FFFFFF" font-family="sans-serif">
      <text x="72" y="140" font-size="24" letter-spacing="2">Innovate | Connect | Grow</text>
      <text x="72" y="288" font-size="82" font-weight="700">Otya</text>
      <text x="76" y="357" font-size="32">One ecosystem. Endless possibilities.</text>
      <text x="76" y="523" font-size="23" fill="#B9DDF5">Developed by OtyaHQ</text>
    </g></svg>`)
  await sharp(card)
    .composite([{ input: await sharp(bytes).resize(300, 300).toBuffer(), left: 820, top: 165 }])
    .jpeg({ quality: 90 })
    .toFile(resolve(process.cwd(), 'public/otya-release-card.jpg'))
}

await sync()
