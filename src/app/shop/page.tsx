import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'

const MAP_URL = 'https://www.google.com/maps/search/?api=1&query=Old+Market%2C+Mbirizi+Town+Council%2C+Lwengo+District%2C+Uganda'

export const metadata: Metadata = {
  title: 'Visit Our Mbirizi Shop | PeterSmart Link',
  description: 'Visit PeterSmart Link at Old Market, Mbirizi for phones and accessories, electronics and in-person mobile-money services. Website information only; no online checkout.',
  keywords: ['PeterSmart Link shop', 'Mbirizi phone shop', 'phones and accessories Mbirizi', 'electronics Mbirizi', 'mobile money Mbirizi', 'Lwengo District'],
  alternates: { canonical: 'https://petersmartlink.com/shop' },
  openGraph: {
    type: 'website',
    url: 'https://petersmartlink.com/shop',
    title: 'Visit Our Mbirizi Shop | PeterSmart Link',
    description: 'Phones and accessories, electronics and mobile-money services at Old Market, Mbirizi, Uganda.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'PeterSmart Link — Mbirizi shop and Otya software' }],
  },
}

const services = [
  {
    number: '01',
    title: 'Phones & accessories',
    description: 'Visit the shop to ask about available phones and everyday mobile accessories.',
  },
  {
    number: '02',
    title: 'Electronics',
    description: 'Explore the electronics available at the shop. Current stock and prices are confirmed in person.',
  },
  {
    number: '03',
    title: 'Mobile-money services',
    description: 'Access in-person mobile-money services at the shop. Ask at the counter about the service you need.',
  },
]

export default function ShopPage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <SiteNav />
    <main className="flex-1">
      <section className="relative overflow-hidden border-b border-black/[.05] dark:border-white/[.07]">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_12%_10%,rgba(41,121,255,.09),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(46,168,201,.08),transparent_30%)]" />
        <div className="otya-shell relative grid gap-8 py-16 sm:py-20 lg:grid-cols-[1.08fr_.92fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-black/[.07] dark:border-white/[.09] bg-white/60 px-3 py-2 text-xs font-black dark:bg-white/[.035]">PeterSmart Link · Mbirizi, Uganda</div>
            <h1 className="mt-7 max-w-[820px] text-[clamp(44px,7vw,78px)] font-black leading-[.98] tracking-[-.065em]">Your local technology shop.</h1>
            <p className="mt-6 max-w-[650px] text-base leading-8 sm:text-xl otya-muted">Visit us at Old Market, Mbirizi for phones and accessories, electronics and in-person mobile-money services. Real people, clear answers and service at the shop.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={MAP_URL} target="_blank" rel="noreferrer" className="cosmos-button inline-flex min-h-12 items-center rounded-full px-6 text-sm font-black">Get directions</a>
              <a href="mailto:support@petersmartlink.com?subject=Shop%20enquiry" className="inline-flex min-h-12 items-center rounded-full border border-black/[.09] dark:border-white/[.12] bg-white/55 px-5 text-sm font-black dark:bg-white/[.035]">Email an enquiry</a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs otya-muted">
              <span>Physical shop</span><span>Mbirizi Town Council</span><span>No online checkout</span>
            </div>
          </div>

          <div className="rounded-[30px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-6 sm:p-8 shadow-[0_24px_70px_rgba(8,11,18,.08)]">
            <div className="otya-kicker">Find the shop</div>
            <h2 className="mt-3 text-2xl font-black tracking-[-.045em] sm:text-3xl">Old Market, Mbirizi</h2>
            <p className="mt-3 text-sm leading-7 otya-muted">Mbirizi Town Council<br/>Lwengo District<br/>Uganda</p>
            <div className="my-6 h-px bg-[color:var(--cosmos-divider)]" />
            <div className="text-sm font-black">A visit-first experience</div>
            <p className="mt-2 text-sm leading-7 otya-muted">Check current stock, prices and service availability with us at the shop before making a decision.</p>
            <a href={MAP_URL} target="_blank" rel="noreferrer" className="mt-5 inline-flex min-h-10 items-center text-sm font-black">Open map directions <span aria-hidden="true" className="ml-2">↗</span></a>
          </div>
        </div>
      </section>

      <section className="otya-shell py-14 sm:py-20" aria-labelledby="shop-services">
        <div className="max-w-[760px]">
          <div className="otya-kicker">What you can visit us for</div>
          <h2 id="shop-services" className="mt-3 text-3xl font-black tracking-[-.055em] sm:text-5xl">Useful technology. Personal service.</h2>
          <p className="mt-4 text-sm leading-7 otya-muted sm:text-base">Our website helps you discover the shop and plan a visit. It is not an online catalogue, marketplace or ordering system.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {services.map(service => <article key={service.number} className="rounded-[26px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-6 sm:p-7">
            <div className="text-xs font-black tracking-[.14em] otya-kicker">{service.number}</div>
            <h3 className="mt-5 text-xl font-black tracking-[-.035em]">{service.title}</h3>
            <p className="mt-3 text-sm leading-7 otya-muted">{service.description}</p>
            <div className="mt-5 text-xs font-bold otya-muted">Available in person · Ask at the shop</div>
          </article>)}
        </div>
      </section>

      <section className="border-y border-black/[.05] bg-black/[.018] dark:border-white/[.07] dark:bg-white/[.018]">
        <div className="otya-shell grid gap-8 py-14 sm:py-20 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div>
            <div className="otya-kicker">How it works</div>
            <h2 className="mt-3 text-3xl font-black tracking-[-.055em] sm:text-5xl">Simple. In person. Straightforward.</h2>
          </div>
          <div className="grid gap-4">
            {[
              ['01', 'Choose what you need', 'Browse the service categories on this page or send an enquiry before visiting.'],
              ['02', 'Visit the shop', 'Come to Old Market in Mbirizi, Lwengo District.'],
              ['03', 'Confirm availability at the counter', 'We confirm the current stock, price and service details with you in person.'],
            ].map(([number, title, description]) => <div key={number} className="flex gap-4 rounded-2xl border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/[.04] text-xs font-black dark:bg-white/[.07]">{number}</div>
              <div><h3 className="font-black">{title}</h3><p className="mt-1 text-sm leading-6 otya-muted">{description}</p></div>
            </div>)}
          </div>
        </div>
      </section>

      <section className="otya-shell py-14 sm:py-20">
        <div className="grid gap-5 rounded-[30px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-6 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="otya-kicker">Before you visit</div>
            <h2 className="mt-3 text-2xl font-black tracking-[-.045em] sm:text-4xl">No online orders or payments.</h2>
            <p className="mt-4 max-w-[720px] text-sm leading-7 otya-muted">PeterSmart Link is currently a physical, visit-in-person shop. This website provides information and directions only. We do not take product orders, card payments or mobile-money payments through this website. Stock, prices and services are confirmed at the shop.</p>
          </div>
          <div className="flex flex-col gap-3">
            <a href={MAP_URL} target="_blank" rel="noreferrer" className="cosmos-button inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-black">Find us in Mbirizi</a>
            <Link href="/company" className="inline-flex min-h-11 items-center justify-center rounded-full border border-black/[.09] dark:border-white/[.12] px-5 text-sm font-black">About PeterSmart Link</Link>
          </div>
        </div>
      </section>

      <section className="otya-shell pb-10 sm:pb-14">
        <div className="rounded-[26px] border border-black/[.07] dark:border-white/[.09] p-6 sm:p-8">
          <div className="otya-kicker">Also from PeterSmart Link</div>
          <h2 className="mt-3 text-2xl font-black tracking-[-.045em] sm:text-3xl">Explore Otya software.</h2>
          <p className="mt-3 max-w-[700px] text-sm leading-7 otya-muted">Alongside our physical shop, we build Otya software products. Otya Player is our Android media application, designed around the music and videos already on your device.</p>
          <Link href="/otya-player" className="mt-5 inline-flex min-h-10 items-center text-sm font-black">Explore Otya Player <span aria-hidden="true" className="ml-2">→</span></Link>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
