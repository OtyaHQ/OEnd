import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import './brand-overrides.css'

const manrope = Manrope({ subsets: ['latin'], display: 'swap', variable: '--font-otya' })
const SITE_URL = 'https://petersmartlink.com'
const ADSENSE_ID = 'ca-pub-2517163652161686'
const OTYA_MARK = '/otya-app-icon.webp'
const SHOP_MAP_URL = 'https://www.google.com/maps/search/?api=1&query=Old+Market%2C+Mbirizi+Town+Council%2C+Lwengo+District%2C+Uganda'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'PeterSmart Link | Mbirizi Technology Shop & Otya Software',
    template: '%s | PeterSmart Link',
  },
  description:
    'PeterSmart Link operates a physical technology shop in Mbirizi, Uganda, and develops Otya software products. Visit for phones and accessories, electronics and in-person mobile-money services.',
  keywords: [
    'Otya',
    'Otya Player',
    'Otya Android',
    'PeterSmart Link',
    'Mbirizi technology shop',
    'phones and accessories Mbirizi',
    'electronics Mbirizi',
    'mobile money Mbirizi',
    'offline music player',
    'offline video player',
    'local music player Android',
    'local video player Android',
    'file transfer Android',
    'watch together Android',
    'private media Android',
    'Uganda technology',
  ],
  authors: [{ name: 'PeterSmart Link', url: SITE_URL }],
  creator: 'PeterSmart Link',
  publisher: 'PeterSmart Link',
  applicationName: 'PeterSmart Link',
  category: 'multimedia',
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
    siteName: 'PeterSmart Link',
    title: 'PeterSmart Link | Mbirizi Shop & Otya Software',
    description:
      'A physical technology shop in Mbirizi and the home of Otya software products, including Otya Player for Android.',
    images: [
      {
        url: OTYA_MARK,
        width: 512,
        height: 512,
        alt: 'Otya by PeterSmart Link',
        type: 'image/webp',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'PeterSmart Link | Mbirizi Shop & Otya Software',
    description: 'A physical technology shop in Mbirizi and the home of Otya software products.',
    images: [OTYA_MARK],
  },
  icons: {
    icon: [{ url: OTYA_MARK, sizes: '512x512', type: 'image/webp' }],
    apple: [{ url: OTYA_MARK, sizes: '512x512', type: 'image/webp' }],
    shortcut: OTYA_MARK,
  },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'PeterSmart Link', statusBarStyle: 'black-translucent' },
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
      name: 'PeterSmart Link',
      url: SITE_URL,
      logo: `${SITE_URL}${OTYA_MARK}`,
      email: 'support@petersmartlink.com',
    },
    {
      '@type': 'Store',
      '@id': `${SITE_URL}/#shop`,
      name: 'PeterSmart Link — Mbirizi Shop',
      url: `${SITE_URL}/shop`,
      parentOrganization: { '@id': `${SITE_URL}/#organization` },
      email: 'support@petersmartlink.com',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Old Market',
        addressLocality: 'Mbirizi',
        addressRegion: 'Lwengo District',
        addressCountry: 'UG',
      },
      hasMap: SHOP_MAP_URL,
      description: 'Physical technology shop for phones and accessories, electronics and in-person mobile-money services. This website provides information and directions; products are not sold online.',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#otya-player`,
      name: 'Otya',
      alternateName: 'Otya Player',
      identifier: 'com.otyaplayer.app',
      operatingSystem: 'Android',
      applicationCategory: 'MultimediaApplication',
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      url: `${SITE_URL}/otya-player`,
      downloadUrl: `${SITE_URL}/download/otya-player`,
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
      name: 'PeterSmart Link',
      alternateName: 'Otya',
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
