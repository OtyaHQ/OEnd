import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import './brand-overrides.css'

const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-otya' })
const SITE_URL = 'https://otya.site'
const ADSENSE_ID = 'ca-pub-2517163652161686'
const OTYA_MARK = '/otya-app-icon.webp'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Otya — Connected products and services',
    template: '%s | Otya',
  },
  description:
    'Explore Otya digital products, account services, official support and OtyaPoint physical shop services in Mbirizi, Lwengo, Uganda.',
  keywords: [
    'Otya',
    'Omy Play',
    'Otya Android',
    'OtyaPoint',
    'Otya ecosystem',
    'Mbirizi physical shop',
    'Lwengo mobile money agency',
    'offline music player',
    'offline video player',
    'local music player Android',
    'local video player Android',
    'file transfer Android',
    'watch together Android',
    'private media Android',
    'Uganda technology',
  ],
  authors: [{ name: 'Otya', url: SITE_URL }],
  creator: 'Otya',
  publisher: 'Otya',
  applicationName: 'Otya',
  category: 'technology',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_UG',
    url: SITE_URL,
    siteName: 'Otya',
    title: 'Otya — Connected products and services',
    description:
      'A connected family of Otya digital products and real-world services.',
    images: [
      {
        url: OTYA_MARK,
        width: 512,
        height: 512,
        alt: 'Otya',
        type: 'image/webp',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Otya — Connected products and services',
    description: 'Explore connected Otya products and services.',
    images: [OTYA_MARK],
  },
  icons: {
    icon: [{ url: OTYA_MARK, sizes: '512x512', type: 'image/webp' }],
    apple: [{ url: OTYA_MARK, sizes: '512x512', type: 'image/webp' }],
    shortcut: OTYA_MARK,
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Otya', statusBarStyle: 'black-translucent' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5FAFF' },
    { media: '(prefers-color-scheme: dark)', color: '#050812' },
  ],
  width: 'device-width', initialScale: 1, maximumScale: 5,
}

const schemaOrg = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Otya',
      description: 'Uganda-based digital products and real-world services. Otya Holdings Limited is the intended parent entity and is in the process of registration.',
      url: SITE_URL,
      logo: `${SITE_URL}${OTYA_MARK}`,
      email: 'support@petersmartlink.com',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#omy-play`,
      name: 'Omy Play',
      alternateName: 'Omy Play',
      identifier: 'com.otyaplayer.app',
      operatingSystem: 'Android',
      applicationCategory: 'MultimediaApplication',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      url: `${SITE_URL}/omy-play`,
      downloadUrl: `${SITE_URL}/download/omy-play`,
      author: { '@id': `${SITE_URL}/#organization` },
      publisher: { '@id': `${SITE_URL}/#organization` },
      description:
        'Offline-first Android music and video app for local media, Otya Transfer, Watch Together, Private media, playlists, subtitles and practical media tools.',
      image: `${SITE_URL}${OTYA_MARK}`,
      featureList: [
        'Local music playback',
        'Local video playback',
        'Background audio',
        'Playlists',
        'Subtitles',
        'Picture-in-Picture',
        'Otya Transfer',
        'Watch Together — Nearby and Anywhere',
        'Private media',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Otya',
      alternateName: 'Otya ecosystem',
      publisher: { '@id': `${SITE_URL}/#organization` },
    },
  ],
}

const initialThemeScript = `try {
  var migrated = localStorage.getItem('otya_theme_device_v3');
  if (!migrated) {
    localStorage.setItem('otya_theme', 'system');
    localStorage.setItem('otya_theme_device_v3', '1');
  }
  var t = localStorage.getItem('otya_theme') || 'system';
  if (t === 'light' || t === 'dark') {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t;
  } else {
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.colorScheme = 'light dark';
  }
} catch (e) {}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" dir="ltr" className={manrope.variable} suppressHydrationWarning>
    <head>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }} />
      <meta name="google-adsense-account" content={ADSENSE_ID} />
      <script
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_ID}`}
        crossOrigin="anonymous"
      />
      <script dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
    </head>
    <body className={manrope.className}>
      {children}
    </body>
  </html>
}
