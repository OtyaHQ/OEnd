import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Terms | Otya',
  description: 'Terms for using Otya accounts, Next and connected services.',
  alternates: { canonical: 'https://petersmartlink.com/terms' },
}

const SECTIONS = [
  ['Acceptance', 'By accessing or using Otya websites, accounts, applications or connected services, you agree to these Terms and applicable product-specific policies.'],
  ['Operator and legal identity', 'Otya is the public brand for the connected product family. The current individual operator/account holder for services still contracted in an individual capacity is Peter Katabira. Otya Holdings Limited is the intended parent entity and its URSB registration is in progress; it is not yet represented as an incorporated company or current merchant-account holder. Any move of merchant, settlement or provider accounts to the company will occur only after incorporation and the provider’s formal approval.'],
  ['Otya account', 'One Otya account may be used across connected Otya services. Product-specific data and permissions remain separately scoped. Core local Otya playback does not require an account.'],
  ['Verification and sign-in', 'Otya uses email and Google as account sign-in methods. Telegram may be used as a separate security-code delivery channel or for an additional owner-verification step; it is not a normal Otya sign-in method. Third-party providers may apply their own terms to those integrations.'],
  ['Services', 'Otya includes local music and video playback, nearby Transfer, Private, tools, Next, downloads, support, account services and other official Otya features made available through approved channels. The retired built-in Online Music/Jamendo catalog is not part of the current service.'],
  ['Local media', 'You are responsible for media you store, play, organize, transfer or process with Otya and for complying with applicable copyright, privacy and other laws. Otya does not obtain ownership of your local media merely because the app accesses it for a feature you choose.'],
  ['Next', 'Next may generate incorrect or incomplete information. Verify important information independently. Customer-facing Next does not receive access to private administrator systems.'],
  ['Prohibited use', 'Do not use Otya for fraud, abuse, unauthorized access, unlawful distribution, copyright infringement, interference with service operation, malware delivery or attempts to obtain secrets or bypass security controls.'],
  ['Software and updates', 'Features, availability and requirements may change over time. Updates may improve security, compatibility, performance and functionality.'],
  ['Third-party services', 'Optional features may interact with services such as Google, Telegram, Firebase, Resend and Cloudflare. Their terms and privacy practices may apply when you use those integrations.'],
  ['Liability', 'To the extent permitted by applicable law, Otya is not responsible for indirect, incidental or consequential losses resulting from use of the services or from third-party service availability.'],
  ['Governing law', 'These terms are governed by the applicable laws of the Republic of Uganda.'],
  ['Contact', 'Questions about these terms can be sent to support@petersmartlink.com.'],
]

export default function TermsPage() {
  return <div className="min-h-screen flex flex-col otya-ambient" style={{ color: 'var(--cosmos-text-primary)' }}>
    <SiteNav />
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-7">
        <div className="otya-kicker mb-2">Otya · Terms</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-.04em]">Clear terms. Less scrolling.</h1>
        <p className="mt-2 text-sm otya-muted">Last updated November 10, 2026. Expand only what you want to read.</p>
      </header>
      <section className="overflow-hidden rounded-[24px] border backdrop-blur-xl" style={{ borderColor:'var(--cosmos-divider)', background:'color-mix(in srgb,var(--cosmos-card) 82%,transparent)' }}>
        {SECTIONS.map(([title, body]) => <details key={title} className="group border-b last:border-b-0" style={{ borderColor:'var(--cosmos-divider)' }}>
          <summary className="cursor-pointer list-none px-4 sm:px-5 py-4 flex items-center justify-between gap-4 font-bold text-sm"><span>{title}</span><span className="text-lg otya-muted group-open:rotate-45 transition-transform">＋</span></summary>
          <p className="px-4 sm:px-5 pb-5 text-sm leading-7 otya-muted">{body}</p>
        </details>)}
      </section>
      <div className="mt-6 flex flex-wrap gap-3 text-sm font-semibold"><Link href="/privacy">Privacy</Link><Link href="/help">Help</Link></div>
    </main>
    <SiteFooter />
  </div>
}
