import type { Metadata } from 'next'
import { DownloadPageClient } from './DownloadButtons'

export const metadata: Metadata = {
  title: 'Download Omy Play for Android',
  description:
    'Download the official Omy Play for Android from Omy Play. Play local music and video offline, use nearby Transfer, Private media and practical media tools.',
  keywords: [
    'download Omy Play',
    'Omy Play Android',
    'Omy Play APK',
    'offline music player Android',
    'offline video player Android',
    'Omy Play',
  ],
  alternates: { canonical: 'https://otya.site/download/omy-play' },
  openGraph: {
    type: 'website',
    url: 'https://otya.site/download/omy-play',
    title: 'Download Omy Play for Android',
    description:
      'Official Android download for Omy Play by Otya — local music and video, offline playback, nearby Transfer and Private media.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Omy Play for Android',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Download Omy Play for Android',
    description: 'Official Omy Play Android download from Omy Play.',
    images: ['/og-image.jpg'],
  },
}

export default function DownloadOmyPlayPage() {
  return <DownloadPageClient />
}
