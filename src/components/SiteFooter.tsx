import { OTYA } from '@/lib/constants'
import Link from 'next/link'

const GROUPS = [
  { title: 'Visit', links: [['Shop in Mbirizi', '/shop'], ['About PeterSmart Link', '/company'], ['Contact', '/contact']] },
  { title: 'Otya', links: [['Otya Player', '/otya-player'], ['Download for Android', '/download/otya-player'], ['Your Space', 'https://space.petersmartlink.com']] },
  { title: 'Support', links: [['Help', '/help'], ['Journal', '/blog'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Delete account', '/delete-account']] },
] as const

export function SiteFooter() {
  return <footer className="mt-16 border-t border-black/[.06] dark:border-white/[.08]">
    <div className="otya-shell py-7 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr] lg:items-start">
        <div>
          <Link href={OTYA.website} className="inline-block text-base font-black tracking-[-.035em]">PeterSmart Link</Link>
          <p className="mt-2 max-w-sm text-sm leading-6 otya-muted">A physical technology shop in Mbirizi and the home of Otya software products.</p>
        </div>
        <div className="grid grid-cols-2 gap-5 sm:gap-8">
          {GROUPS.map(group => <div key={group.title}>
            <div className="text-xs font-black uppercase tracking-[.12em] otya-muted">{group.title}</div>
            <div className="mt-3 grid gap-1">
              {group.links.map(([label, href]) => <Link key={label} href={href.startsWith('/') ? `${OTYA.website}${href}` : href} className="inline-flex min-h-9 items-center text-sm font-semibold hover:text-[color:var(--cosmos-primary)]">{label}</Link>)}
            </div>
          </div>)}
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-1 border-t border-black/[.05] pt-4 text-xs otya-muted sm:flex-row sm:items-center sm:justify-between dark:border-white/[.06]">
        <span>© {new Date().getFullYear()} PeterSmart Link</span>
        <span>Phones · Electronics · Mobile money · Otya software</span>
      </div>
    </div>
  </footer>
}
