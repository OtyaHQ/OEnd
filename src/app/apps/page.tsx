import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'
import { PUBLIC_URLS } from '@/lib/public-urls'

export const metadata: Metadata = {
  title: 'Otya products and services',
  description: 'Explore Otya digital products, account services and the OtyaPoint physical shop.',
  alternates: { canonical: `${PUBLIC_URLS.primary}/apps` },
}

export default function ProductsPage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <SiteNav />
    <main className="flex-1">
      <section className="otya-shell py-14 sm:py-20">
        <div className="max-w-[820px]">
          <div className="otya-kicker">Otya ecosystem</div>
          <h1 className="mt-3 text-[clamp(42px,7vw,78px)] font-black tracking-[-.065em] leading-[.95]">Digital products and real-world services.</h1>
          <p className="mt-5 max-w-[720px] text-base sm:text-xl leading-8 otya-muted">Explore our digital products and the physical OtyaPoint shop. Each experience has a clear purpose and its own customer journey.</p>
        </div>
      </section>

      <section className="otya-shell pb-16 sm:pb-24 grid gap-4">
        <article className="overflow-hidden rounded-[32px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] grid lg:grid-cols-[.95fr_1.05fr] items-center">
          <div className="p-7 sm:p-10 lg:p-12">
            <div className="flex items-center gap-3"><OtyaBrandMark size={44}/><div><div className="text-xs font-black otya-muted">Android</div><h2 className="text-3xl sm:text-4xl font-black tracking-[-.05em]">Otya Media</h2></div></div>
            <p className="mt-5 max-w-[620px] text-sm sm:text-base leading-7 otya-muted">Offline-first local music and video playback, nearby Transfer, Private media and practical media tools.</p>
            <div className="mt-7 flex flex-wrap gap-3"><Link href="/otya-player" className="cosmos-button inline-flex min-h-11 items-center rounded-full px-5 text-sm font-black">Explore Otya Media</Link><Link href="/download/otya-player" className="inline-flex min-h-11 items-center rounded-full border border-black/[.08] dark:border-white/[.10] px-5 text-sm font-black">Download</Link></div>
          </div>
          <div className="p-4 sm:p-6 lg:p-8"><Image src="/brand/otya-app-preview.svg" alt="Otya Media application preview" width={1200} height={820} className="w-full h-auto rounded-[26px]" /></div>
        </article>

        <div className="grid md:grid-cols-2 gap-4">
          <article className="rounded-[28px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-7 sm:p-8">
            <OtyaBrandMark ai size={42}/>
            <div className="mt-6 text-xs font-black otya-muted">Assistant</div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-[-.045em]">Next</h2>
            <p className="mt-3 text-sm leading-7 otya-muted">A connected assistant for questions, Otya guidance and supported account experiences.</p>
            <Link href="/ask" className="mt-6 inline-flex text-sm font-black">Open Next →</Link>
          </article>

          <article className="rounded-[28px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-7 sm:p-8">
            <div className="h-11 w-11 rounded-2xl grid place-items-center border border-black/[.07] dark:border-white/[.09] font-black">S</div>
            <div className="mt-6 text-xs font-black otya-muted">Account environment</div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-[-.045em]">Space</h2>
            <p className="mt-3 text-sm leading-7 otya-muted">One signed-in place for your Otya account, security, devices, providers, settings, Next and role-authorized Admin controls.</p>
            <Link href={PUBLIC_URLS.space} className="mt-6 inline-flex text-sm font-black">Open Space →</Link>
          </article>
        <article className="overflow-hidden rounded-[30px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-7 sm:p-9 lg:p-10 grid lg:grid-cols-[1fr_auto] gap-7 items-center">
          <div>
            <div className="otya-kicker">Physical shop · Mbirizi, Lwengo</div>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-[-.055em]">OtyaPoint</h2>
            <p className="mt-4 max-w-[720px] text-sm sm:text-base leading-7 otya-muted">Phones and accessories, electronics, and mobile-money agency services at our physical shop in the Old Market area of Mbirizi. Check availability before visiting.</p>
            <p className="mt-4 text-xs otya-muted">This is an in-person shop, not an online checkout.</p>
          </div>
          <Link href="/otyapoint" className="cosmos-button inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-black">Visit OtyaPoint ↗</Link>
        </article>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
