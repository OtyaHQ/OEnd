import type { Metadata } from 'next'
import { SiteNav } from '@/components/SiteNav'
import { OtyaAssistPrompt } from '../../components/OtyaAssistPrompt'

export const metadata: Metadata = {
  title: 'Otya Help',
  description: 'Get public Otya product guidance, service information and support.',
  robots: { index: false, follow: false },
}

export default function OtyaHelpPage() {
  return <div className="h-dvh overflow-hidden flex flex-col" style={{ color:'var(--cosmos-text-primary)', background:'var(--cosmos-scaffold)' }}>
    <SiteNav />
    <main className="flex-1 min-h-0 px-3 sm:px-5 py-3 sm:py-4">
      <div className="mx-auto h-full max-w-[920px] flex flex-col min-h-0">
        <OtyaAssistPrompt compact />
      </div>
    </main>
  </div>
}
