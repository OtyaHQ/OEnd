import { readFile, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import sharp from 'sharp'

// Immutable owner-approved cyan/blue Otya identity, vendored from
// assets/branding/otya_app_icon.webp. Builds must work with private repositories.
const APPROVED_APP_COMMIT = '63be1b59f1a261c853aab786cef584a70e29989d'
const EXPECTED_SHA256 = '34f8e6568b52900d8eaa7c30cd304770d60fb56745b6e2ed3874bc61ab205c51'
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
  // Canonical Otya asset is a lossy VP8 WebP. Width/height are the 14-bit
  // little-endian values immediately after the 0x9d012a frame marker.
  if (bytes.length < 30 || bytes.subarray(12, 16).toString('ascii') !== 'VP8 ') {
    return null
  }
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
  const bytes = await readFile(resolve(process.cwd(), TARGET))
  if (createHash('sha256').update(bytes).digest('hex') !== EXPECTED_SHA256) {
    throw new Error('Local Otya mark does not match the approved asset checksum.')
  }
  if (!isCanonicalWebP(bytes)) {
    throw new Error('Approved Otya mark did not resolve to the expected 512x512 WebP asset.')
  }

  // Old builds generated malformed PNG bytes into many icon paths. Remove all
  // retired generated names so a dirty workspace cannot publish stale branding.
  await Promise.all(
    RETIRED_GENERATED_TARGETS.map(target => rm(resolve(process.cwd(), target), { force: true })),
  )

  console.log(`Verified canonical Otya WebP at ${TARGET} (approved asset ${APPROVED_APP_COMMIT}).`)
  const socialCard = Buffer.from(`<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#27E8FF"/>
        <stop offset=".55" stop-color="#126BFF"/>
        <stop offset="1" stop-color="#173BFF"/>
      </linearGradient>
      <radialGradient id="glow"><stop stop-color="#126BFF" stop-opacity=".36"/><stop offset="1" stop-color="#126BFF" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1200" height="630" fill="#050812"/>
    <circle cx="1000" cy="120" r="410" fill="url(#glow)"/>
    <path d="M0 540C230 430 340 610 560 500S920 300 1200 360V630H0Z" fill="#0A1020"/>
    <rect x="88" y="76" width="54" height="5" rx="2.5" fill="url(#brand)"/>
    <g fill="#F7FAFF" font-family="Arial,Helvetica,sans-serif">
      <text x="88" y="164" font-size="26" font-weight="700" letter-spacing="6">OTYA</text>
      <text x="88" y="300" font-size="108" font-weight="800" letter-spacing="-5">Otya</text>
      <text x="94" y="370" font-size="34" fill="#D5E6FF">One connected product family.</text>
      <text x="94" y="525" font-size="24" fill="#9FB7D7">Digital products. Real-world services. Built in Uganda.</text>
    </g>
  </svg>`)
  const composed = await sharp(socialCard)
    .composite([{ input: await sharp(bytes).resize(300, 300).png().toBuffer(), left: 790, top: 168 }])
    .jpeg({ quality: 92, mozjpeg: true }).toBuffer()
  await Promise.all([
    sharp(composed).toFile(resolve(process.cwd(), 'public/og-image.jpg')),
    sharp(composed).toFile(resolve(process.cwd(), 'public/otya-release-card.jpg')),
  ])
}

await sync()
