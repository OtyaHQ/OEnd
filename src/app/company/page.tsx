import Link from 'next/link'
import type { Metadata } from 'next'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Company | PeterSmart Link',
  description: 'PeterSmart Link operates a physical technology shop in Mbirizi and develops practical Otya software products.',
  alternates: { canonical: 'https://petersmartlink.com/company' },
}

const principles = [
  ['Useful before impressive', 'Products should solve a clear everyday problem before adding complexity.'],
  ['Secure by default', 'Identity, permissions, private data and production operations are protected on the server, not by UI assumptions.'],
  ['Fast on ordinary devices', 'Interfaces should remain responsive on real mobile hardware and variable network conditions.'],
  ['A real local presence', 'Our Mbirizi shop serves customers in person. This website provides information and directions, not an online checkout.'],
  ['Clear product boundaries', 'PeterSmart Link is the public business identity. Otya is our software product family. Space is the signed-in environment.'],
] as const

export default function CompanyPage() {
  return <div className="min-h-screen flex flex-col bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <SiteNav />
    <main className="flex-1">
      <section className="otya-shell py-16 sm:py-24">
        <div className="max-w-[900px]">
          <div className="otya-kicker">PeterSmart Link</div>
          <h1 className="mt-4 text-[clamp(44px,7vw,84px)] font-black tracking-[-.065em] leading-[.94]">Practical technology, built with care.</h1>
          <p className="mt-6 max-w-[720px] text-base sm:text-xl leading-8 otya-muted">PeterSmart Link is based in Uganda. We serve customers in person from our physical shop in Mbirizi, offering phones and accessories, electronics and mobile-money services. We also develop Otya software products designed to be useful, understandable and dependable on real devices.</p>
        </div>
      </section>

      <section className="border-y border-black/[.05] dark:border-white/[.07] bg-black/[.018] dark:bg-white/[.018]">
        <div className="otya-shell py-14 sm:py-20 grid md:grid-cols-2 gap-4">
          {principles.map(([title, text]) => <article key={title} className="rounded-[26px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-6 sm:p-8">
            <h2 className="text-xl sm:text-2xl font-black tracking-[-.035em]">{title}</h2>
            <p className="mt-3 text-sm sm:text-base leading-7 otya-muted">{text}</p>
          </article>)}
        </div>
      </section>

      <section className="otya-shell py-14 sm:py-20">
        <div className="grid lg:grid-cols-[1fr_.9fr] gap-8 items-start">
          <div>
            <div className="otya-kicker">Based in Uganda</div>
            <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-[-.055em]">Build locally. Design for real-world use.</h2>
            <p className="mt-4 max-w-[680px] text-sm sm:text-base leading-7 otya-muted">Our work brings together in-person technology services and software development. Otya Player is designed around local media, offline use and direct device workflows, while our shop keeps customer service personal and local.</p>
          </div>
          <div className="rounded-[28px] border border-black/[.06] dark:border-white/[.08] bg-[color:var(--cosmos-surface)] p-6 sm:p-8">
            <div className="text-sm font-black">PeterSmart Link</div>
            <div className="mt-4 grid gap-3 text-sm">
              <Link href="/shop" className="font-bold">Visit our Mbirizi shop →</Link>
              <Link href="/apps" className="font-bold">Software products →</Link>
              <Link href="/developers" className="font-bold">Developer resources →</Link>
              <Link href="https://docs.petersmartlink.com" className="font-bold">Documentation →</Link>
              <Link href="/contact" className="font-bold">Contact →</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
