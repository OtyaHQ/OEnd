import type { Metadata } from 'next'
import { DownloadPageClient } from '../otya-player/DownloadButtons'

export const metadata: Metadata = {
  title: 'Download Omy Play for Android',
  description: 'Download Omy Play for Android from Otya. Play local music and video offline, share nearby and protect Private media.',
  keywords: ['download Omy Play', 'Omy Play Android', 'offline music player Android', 'offline video player Android'],
  alternates: { canonical: 'https://otya.site/download/omy-play' },
  openGraph: {
    type: 'website',
    url: 'https://otya.site/download/omy-play',
    title: 'Download Omy Play for Android',
    description: 'Official Omy Play Android download — local music and video, offline playback, nearby Send and Private media.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Omy Play for Android' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Download Omy Play for Android',
    description: 'Official Omy Play Android download from Otya.',
    images: ['/og-image.jpg'],
  },
}

export default function DownloadOmyPlayPage() {
  return <DownloadPageClient />
}
