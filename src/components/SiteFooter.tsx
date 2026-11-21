import { OTYA } from '@/lib/constants'
import Link from 'next/link'

const GROUPS = [
  { title: 'Products', links: [['Omy Play', '/omy-play'], ['Download Omy Play', '/download/omy-play'], ['Opoint shop', '/shop'], ['OID & Space', 'https://space.otya.site']] },
  { title: 'Company', links: [['Products', '/apps'], ['Company', '/company'], ['Developers', '/developers']] },
  { title: 'Support', links: [['Help', '/help'], ['Journal', '/blog'], ['Privacy', '/privacy'], ['Terms', '/terms'], ['Delete account', '/delete-account']] },
] as const

export function SiteFooter() {
  return <footer className="mt-16 border-t border-black/[.06] dark:border-white/[.08]">
    <div className="otya-shell py-7 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr] lg:items-start">
        <div>
          <Link href={OTYA.website} className="inline-block" aria-label="Otya home"><img src="https://assets.otya.site/brand/otya/v4/otya-master-lockup.webp" width="190" height="71" alt="Otya — One ecosystem. Endless possibilities. Developed by OtyaHQ" className="h-auto w-[190px] max-w-full object-contain" /></Link>
          <p className="mt-2 max-w-sm text-sm leading-6 otya-muted">One ecosystem. Endless possibilities. Innovate | Connect | Grow.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 sm:gap-8">
          {GROUPS.map(group => <div key={group.title}>
            <div className="text-xs font-black uppercase tracking-[.12em] otya-muted">{group.title}</div>
            <div className="mt-3 grid gap-1">
              {group.links.map(([label, href]) => <Link key={label} href={href.startsWith('/') ? `${OTYA.website}${href}` : href} className="inline-flex min-h-9 items-center text-sm font-semibold hover:text-[color:var(--cosmos-primary)]">{label}</Link>)}
            </div>
          </div>)}
        </div>
      </div>
      <div className="mt-7 flex justify-center"><img src="https://assets.otya.site/brand/otya/v4/otya-company-footer.webp" width="560" height="85" alt="Otya Holdings Limited — Powering a smarter, more connected world." className="h-auto w-full max-w-[560px] object-contain" /></div>
      <div className="mt-6 flex flex-col gap-1 border-t border-black/[.05] pt-4 text-xs otya-muted sm:flex-row sm:items-center sm:justify-between dark:border-white/[.06]">
        <span>© {new Date().getFullYear()} Otya</span>
        <span>Developed by OtyaHQ</span>
      </div>
    </div>
  </footer>
}
