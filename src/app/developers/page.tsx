import { PUBLIC_URLS } from '@/lib/public-urls'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Developers | Otya',
  description: 'Developer resources, documentation, status and integration guidance for Otya products.',
  alternates: { canonical: `${PUBLIC_URLS.primary}/developers` },
}

const resources = [
  ['Documentation', 'Product behavior, account setup, troubleshooting and supported integration guidance.', PUBLIC_URLS.docs],
  ['Service status', 'Current operational state and incident information for public services.', PUBLIC_URLS.status],
  ['Security', 'Responsible security guidance and safe ways to report a security concern.', '/help#security'],
  ['Contact', 'Reach Otya for product, support or developer questions.', '/contact'],
] as const

export default function DevelopersPage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <SiteNav />
    <main className="flex-1">
      <section className="otya-shell py-16 sm:py-24">
        <div className="max-w-[900px]">
          <div className="otya-kicker">Developers</div>
          <h1 className="mt-4 text-[clamp(44px,7vw,82px)] font-black tracking-[-.065em] leading-[.94]">Build against documented behavior, not hidden internals.</h1>
          <p className="mt-6 max-w-[760px] text-base sm:text-xl leading-8 otya-muted">Otya keeps public developer guidance separate from private production infrastructure. Use the documented product surfaces and supported interfaces; internal Worker names, secrets, database identifiers and operational credentials are not part of the public API.</p>
        </div>
      </section>

      <section className="otya-shell pb-16 sm:pb-24">
        <div className="grid md:grid-cols-2 gap-4">
          {resources.map(([title, text, href]) => <Link key={title} href={href} className="group rounded-[26px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-6 sm:p-8 min-h-[210px] flex flex-col">
            <div className="text-xs font-black otya-muted">Otya</div>
            <h2 className="mt-2 text-2xl font-black tracking-[-.04em]">{title}</h2>
            <p className="mt-3 text-sm leading-7 otya-muted">{text}</p>
            <span className="mt-auto pt-6 text-sm font-black">Open →</span>
          </Link>)}
        </div>

        <div className="mt-8 rounded-[28px] border border-black/[.06] dark:border-white/[.08] bg-black/[.018] dark:bg-white/[.018] p-7 sm:p-9">
          <div className="otya-kicker">Identity model</div>
          <h2 className="mt-3 text-2xl sm:text-4xl font-black tracking-[-.045em]">One account. Multiple sign-in methods. Server-authorized roles.</h2>
          <p className="mt-4 max-w-[820px] text-sm sm:text-base leading-7 otya-muted">Email, Google and supported connected providers resolve to one Otya identity. Admin is a permissioned role inside that identity model, not a separate username/password system. Privileged backend operations remain server-enforced even when the Admin UI is visible.</p>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
