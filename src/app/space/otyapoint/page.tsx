import type { Metadata } from 'next'
import { SpaceOtyaPointDashboard } from '@/components/SpaceOtyaPointDashboard'

export const metadata: Metadata = {
  title: 'OtyaPoint · Company operations',
  description: 'Private OtyaPoint company operations workspace.',
  robots: { index: false, follow: false },
}

export default function OtyaPointOperationsPage() {
  return <SpaceOtyaPointDashboard />
}
