import type { Metadata } from 'next'
import OmyPlayContent from '../otya-player/page'

export const metadata: Metadata = {
  title: 'Omy Play — Offline Music & Video for Android',
  description: 'Omy Play is an offline-first Android media player for local music, video, nearby sharing and private media.',
  alternates: { canonical: 'https://otya.site/omy-play' },
  openGraph: {
    type: 'website',
    url: 'https://otya.site/omy-play',
    title: 'Omy Play — Your media. Still yours.',
    description: 'Play local media offline with Omy Play.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Omy Play by Otya' }],
  },
}

export default function OmyPlayPage() {
  return <OmyPlayContent />
}
