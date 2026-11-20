import type { Metadata } from 'next'
import OpointContent from '../otyapoint/page'

export const metadata: Metadata = {
  title: 'Opoint | Physical shop in Mbirizi, Lwengo',
  description: 'Visit Opoint in the Old Market area of Mbirizi, Lwengo, Uganda for phones and accessories, electronics and mobile-money agency services.',
  alternates: { canonical: 'https://otya.site/opoint' },
  openGraph: {
    type: 'website',
    url: 'https://otya.site/opoint',
    title: 'Opoint | Visit our physical shop',
    description: 'Phones and accessories, electronics and mobile-money agency services in Mbirizi, Lwengo, Uganda.',
  },
}

export default function OpointPage() {
  return <OpointContent />
}
