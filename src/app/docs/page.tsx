import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Documentation | Otya',
  description: 'Official documentation for Otya Media, Otya accounts, Space, security and supported Otya services.',
  alternates: { canonical: 'https://docs.petersmartlink.com' },
}

const sections = [
  {
    title: 'Get started',
    description: 'Understand Otya Media, install safely and learn which features work without an account or internet connection.',
    links: [['Otya Media overview', '/otya-player'], ['Download Otya Media', '/download/otya-player'], ['Help and troubleshooting', '/help']],
  },
  {
    title: 'Account & Space',
    description: 'One Otya identity can use multiple sign-in methods. Space is the signed-in environment for account and security controls.',
    links: [['Sign in to Otya', 'https://space.petersmartlink.com/sign-in'], ['Open Space', 'https://space.petersmartlink.com'], ['Account help', '/help']],
  },
  {
    title: 'Playback & local media',
    description: 'Learn the product boundaries for local music, video, background playback, nearby Transfer and Private media.',
    links: [['Music', '/music'], ['Otya Media', '/otya-player'], ['Troubleshooting', '/help']],
  },
  {
    title: 'Trust & operations',
    description: 'Use official support, public service status and legal information without exposing private production internals.',
    links: [['Service status', 'https://status.petersmartlink.com'], ['Privacy', '/privacy'], ['Terms', '/terms']],
  },
] as const

export default function DocumentationPage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <SiteNav />
    <main className="flex-1">
      <section className="otya-shell py-14 sm:py-20">
        <div className="max-w-[860px]">
          <div className="otya-kicker">Documentation</div>
          <h1 className="mt-3 text-[clamp(42px,7vw,78px)] font-black tracking-[-.065em] leading-[.95]">Find the right answer without digging through the system.</h1>
          <p className="mt-5 max-w-[720px] text-base sm:text-xl leading-8 otya-muted">Official guidance for Otya products, accounts and supported services. Public documentation describes product behavior and safe user workflows; private infrastructure details stay private.</p>
        </div>
      </section>

      <section className="otya-shell pb-16 sm:pb-24">
        <div className="grid md:grid-cols-2 gap-4">
          {sections.map(section => <article key={section.title} className="rounded-[26px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-6 sm:p-8">
            <h2 className="text-2xl font-black tracking-[-.04em]">{section.title}</h2>
            <p className="mt-3 text-sm leading-7 otya-muted">{section.description}</p>
            <div className="mt-6 grid gap-2.5">{section.links.map(([label, href]) => <Link key={label} href={href} className="text-sm font-black">{label} →</Link>)}</div>
          </article>)}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-[24px] border border-black/[.06] dark:border-white/[.08] p-5 sm:p-6">
          <div><div className="font-black">Still need help?</div><p className="mt-1 text-sm otya-muted">Use human support or ask Next from your Otya environment.</p></div>
          <div className="flex flex-wrap gap-3"><Link href="/help" className="inline-flex min-h-10 items-center rounded-full border border-black/[.08] dark:border-white/[.10] px-4 text-sm font-black">Support</Link><Link href="https://space.petersmartlink.com/ask" className="cosmos-button inline-flex min-h-10 items-center rounded-full px-4 text-sm font-black">Open Next</Link></div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
