import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'

const SITE_URL = 'https://petersmartlink.com'
const MAP_URL = 'https://www.google.com/maps/search/?api=1&query=Old%20Market%2C%20Mbirizi%2C%20Lwengo%20District%2C%20Uganda'
const ENQUIRY_URL = 'mailto:support@petersmartlink.com?subject=OtyaPoint%20shop%20enquiry'

export const metadata: Metadata = {
  title: 'OtyaPoint | Physical shop in Mbirizi, Lwengo',
  description: 'Visit OtyaPoint in the Old Market area of Mbirizi, Lwengo, Uganda for phones and accessories, electronics, and mobile-money agency services.',
  keywords: ['OtyaPoint', 'phones and accessories Mbirizi', 'electronics Mbirizi', 'mobile money agent Mbirizi', 'Old Market Mbirizi', 'Lwengo Uganda'],
  alternates: { canonical: `${SITE_URL}/otyapoint` },
  openGraph: {
    type: 'website',
    url: `${SITE_URL}/otyapoint`,
    title: 'OtyaPoint | Visit our physical shop',
    description: 'Phones and accessories, electronics, and mobile-money agency services in Mbirizi, Lwengo, Uganda.',
  },
}

const businessSchema = {
  '@context': 'https://schema.org',
  '@type': 'RetailStore',
  '@id': `${SITE_URL}/otyapoint#store`,
  name: 'OtyaPoint',
  url: `${SITE_URL}/otyapoint`,
  description: 'Physical retail shop offering phones and accessories, electronics, and mobile-money agency services.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Mbirizi',
    addressRegion: 'Lwengo District',
    addressCountry: 'UG',
  },
}

const services = [
  {
    number: '01',
    title: 'Phones & accessories',
    description: 'Visit the shop to ask about available phones, accessories and compatible items.',
    detail: 'Availability is confirmed in person or by enquiry.',
  },
  {
    number: '02',
    title: 'Electronics',
    description: 'Explore the electronics currently available at the physical shop.',
    detail: 'Ask about a specific item before travelling.',
  },
  {
    number: '03',
    title: 'Mobile-money agency',
    description: 'Access agency services at the shop in person.',
    detail: 'Transactions are handled at the physical location, not through this website.',
  },
] as const

export default function OtyaPointPage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <SiteNav />
    <main className="flex-1">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }} />

      <section className="relative overflow-hidden border-b border-black/[.05] dark:border-white/[.07]">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_10%_12%,rgba(39,232,255,.12),transparent_30%),radial-gradient(circle_at_90%_18%,rgba(18,107,255,.12),transparent_32%)]" />
        <div className="otya-shell relative py-14 sm:py-20 lg:py-24">
          <div className="max-w-[900px]">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/[.07] dark:border-white/[.10] bg-[color:var(--cosmos-surface)] px-4 py-2 text-xs font-black tracking-[.08em] uppercase otya-muted">OtyaPoint · Physical shop</div>
            <h1 className="mt-7 max-w-[850px] text-[clamp(42px,7vw,82px)] font-black tracking-[-.065em] leading-[.98]">Everyday technology.<br/><span className="otya-muted">A real place to visit.</span></h1>
            <p className="mt-6 max-w-[720px] text-base sm:text-xl leading-8 otya-muted">Visit OtyaPoint in the Old Market area of Mbirizi, Lwengo. Find phones and accessories, electronics, and mobile-money agency services at our physical shop.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={MAP_URL} target="_blank" rel="noopener noreferrer" className="cosmos-button inline-flex min-h-12 items-center rounded-full px-6 text-sm font-black">Find the shop area</a>
              <a href={ENQUIRY_URL} className="inline-flex min-h-12 items-center rounded-full border border-black/[.10] dark:border-white/[.12] bg-[color:var(--cosmos-surface)] px-5 text-sm font-black">Ask about availability</a>
            </div>
            <p className="mt-5 text-xs sm:text-sm otya-muted">Mbirizi · Lwengo District · Uganda</p>
          </div>
        </div>
      </section>

      <section className="otya-shell py-12 sm:py-16" aria-labelledby="shop-services">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="otya-kicker">What you can find</div>
            <h2 id="shop-services" className="mt-3 text-3xl sm:text-5xl font-black tracking-[-.055em]">Shop services</h2>
          </div>
          <p className="max-w-[460px] text-sm sm:text-base leading-7 otya-muted">Visit the shop or contact us first to check current availability. We publish only the service categories currently offered here.</p>
        </div>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {services.map(service => <article key={service.number} className="rounded-[26px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-6 sm:p-7">
            <div className="text-xs font-black tracking-[.14em] otya-muted">{service.number}</div>
            <h3 className="mt-6 text-xl sm:text-2xl font-black tracking-[-.04em]">{service.title}</h3>
            <p className="mt-3 text-sm leading-7 otya-muted">{service.description}</p>
            <p className="mt-5 border-t border-black/[.06] dark:border-white/[.08] pt-4 text-xs leading-6 otya-muted">{service.detail}</p>
          </article>)}
        </div>
      </section>

      <section className="border-y border-black/[.05] dark:border-white/[.07] bg-black/[.018] dark:bg-white/[.018]">
        <div className="otya-shell py-12 sm:py-16 grid lg:grid-cols-[1fr_.85fr] gap-8 items-start">
          <div>
            <div className="otya-kicker">Visit us</div>
            <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-[-.055em]">Find us in Mbirizi.</h2>
            <p className="mt-4 max-w-[620px] text-sm sm:text-base leading-7 otya-muted">OtyaPoint is in the Old Market area of Mbirizi, Lwengo District, Uganda. The map link opens the Old Market area as a landmark; it is not a verified door-to-door pin.</p>
            <div className="mt-6 rounded-[24px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-5 sm:p-6">
              <div className="text-xs font-black uppercase tracking-[.12em] otya-muted">Shop location</div>
              <p className="mt-2 text-lg font-black">Old Market area</p>
              <p className="mt-1 text-sm otya-muted">Mbirizi, Lwengo District, Uganda</p>
              <a href={MAP_URL} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex text-sm font-black">Open area in Google Maps ↗</a>
            </div>
          </div>
          <div className="rounded-[28px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-6 sm:p-8">
            <div className="otya-kicker">Before you visit</div>
            <h3 className="mt-3 text-2xl sm:text-3xl font-black tracking-[-.045em]">Check first. Then come by.</h3>
            <p className="mt-4 text-sm leading-7 otya-muted">Stock and service availability can change. For current opening times or a specific item, send an enquiry before travelling.</p>
            <a href={ENQUIRY_URL} className="cosmos-button mt-6 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-black">Email an enquiry</a>
            <p className="mt-4 text-xs otya-muted">support@petersmartlink.com</p>
          </div>
        </div>
      </section>

      <section className="otya-shell py-12 sm:py-16">
        <div className="rounded-[30px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-6 sm:p-9 lg:p-11 grid lg:grid-cols-[1fr_auto] gap-7 items-center">
          <div>
            <div className="otya-kicker">A physical-shop experience</div>
            <h2 className="mt-3 text-2xl sm:text-4xl font-black tracking-[-.05em]">This website helps you visit. It does not take online orders.</h2>
            <p className="mt-4 max-w-[760px] text-sm sm:text-base leading-7 otya-muted">Browse the services, check the location and ask about availability. Purchases and mobile-money agency services are handled in person at OtyaPoint. There is no online cart, checkout or online payment on this site.</p>
          </div>
          <Link href="/apps" className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/[.10] dark:border-white/[.12] px-5 text-sm font-black">Explore Otya products</Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
