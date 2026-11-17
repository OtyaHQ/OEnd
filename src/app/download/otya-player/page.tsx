import { PUBLIC_URLS } from '@/lib/public-urls'
import type { Metadata } from 'next'
import { DownloadPageClient } from './DownloadButtons'

export const metadata: Metadata = {
  title: 'Download Otya Media for Android',
  description:
    'Download the official Otya Media for Android from Otya. Play local music and video offline, use nearby Transfer, Private media and practical media tools.',
  keywords: [
    'download Otya Media',
    'Otya Media Android',
    'Otya APK',
    'offline music player Android',
    'offline video player Android',
    'Otya Otya',
  ],
  alternates: { canonical: `${PUBLIC_URLS.primary}/download/otya-player` },
  openGraph: {
    type: 'website',
    url: `${PUBLIC_URLS.primary}/download/otya-player`,
    title: 'Download Otya Media for Android',
    description:
      'Official Android download for Otya Media by Otya — local music and video, offline playback, nearby Transfer and Private media.',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Otya Media for Android',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Download Otya Media for Android',
    description: 'Official Otya Media Android download from Otya.',
    images: ['/og-image.jpg'],
  },
}

export default function DownloadOtyaPlayerPage() {
  return <DownloadPageClient />
}
