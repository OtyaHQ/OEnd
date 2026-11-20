import type { Metadata } from 'next'
import { DownloadPageClient } from '../otya-player/DownloadButtons'

export const metadata: Metadata = {
  title: 'Download Omy Play for Android',
  description: 'Download the official Omy Play Android app from Otya.',
  alternates: { canonical: 'https://otya.site/download/omy-play' },
  openGraph: {
    type: 'website',
    url: 'https://otya.site/download/omy-play',
    title: 'Download Omy Play for Android',
    description: 'Official Android download for Omy Play.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Omy Play by Otya' }],
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
