import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'

export const metadata: Metadata = {
  title: 'Delete your Otya account | Otya',
  description: 'How to request deletion of your Otya account and associated server-side data.',
  alternates: { canonical: 'https://petersmartlink.com/delete-account' },
}

const deletionEmail = 'mailto:support@petersmartlink.com?subject=Otya%20account%20deletion%20request'

export default function DeleteAccountPage() {
  return <div className="min-h-screen flex flex-col otya-ambient" style={{ color: 'var(--cosmos-text-primary)' }}>
    <SiteNav />
    <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <header className="mb-7">
        <div className="otya-kicker mb-2">Otya · Account deletion</div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[-.04em]">Delete your Otya account</h1>
        <p className="mt-3 text-sm sm:text-base leading-7 otya-muted">This is Otya Media&apos;s public account-deletion request page. You can request deletion even if you no longer have the Android app installed.</p>
      </header>

      <section className="rounded-[24px] border p-5 sm:p-6" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
        <h2 className="text-xl font-black tracking-[-.025em]">Request deletion</h2>
        <div className="mt-4 grid gap-4 text-sm leading-7 otya-muted">
          <p><strong className="font-black" style={{ color: 'var(--cosmos-text-primary)' }}>From Otya Media:</strong> open <strong>Me → Otya Account → Delete account</strong> and follow the confirmation steps.</p>
          <p><strong className="font-black" style={{ color: 'var(--cosmos-text-primary)' }}>Without the app:</strong> email Otya support and ask for your Otya account to be deleted. When possible, send the request from an email address already linked to the account, or include your public Otya ID so ownership can be verified.</p>
          <p>Never send a password, one-time code, access token, refresh token, API key or other secret in a deletion request.</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={deletionEmail} className="cosmos-button min-h-11 inline-flex items-center justify-center rounded-xl px-5 text-sm font-black">Email deletion request</a>
          <Link href="https://space.petersmartlink.com/account" className="min-h-11 inline-flex items-center justify-center rounded-xl border px-5 text-sm font-black" style={{ borderColor: 'var(--cosmos-divider)' }}>Open Otya Space</Link>
        </div>
      </section>

      <section className="mt-5 rounded-[24px] border p-5 sm:p-6" style={{ borderColor: 'var(--cosmos-divider)', background: 'color-mix(in srgb,var(--cosmos-card) 82%,transparent)' }}>
        <h2 className="text-xl font-black tracking-[-.025em]">What account deletion removes</h2>
        <ul className="mt-4 grid gap-2.5 text-sm leading-7 otya-muted list-disc pl-5">
          <li>Your Otya account identity.</li>
          <li>Active Otya authentication sessions and refresh credentials.</li>
          <li>Account security, consent and connected-account state associated with the deleted identity.</li>
          <li>Server-side Otya product data associated with the account through the production deletion flow.</li>
        </ul>
        <p className="mt-4 text-sm leading-7 otya-muted">Media files that exist only on your phone are not deleted from your device. Otya does not upload local media merely because you play, browse, search or organize it.</p>
      </section>

      <section className="mt-5 rounded-[24px] border p-5 sm:p-6" style={{ borderColor: 'var(--cosmos-divider)' }}>
        <h2 className="text-xl font-black tracking-[-.025em]">Need help before deleting?</h2>
        <p className="mt-3 text-sm leading-7 otya-muted">If you are locked out or unsure which identity is linked, contact support first. Otya verifies account ownership before a manual deletion request is completed.</p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm font-bold"><Link href="/privacy">Privacy</Link><Link href="/help">Help</Link><a href="mailto:support@petersmartlink.com">support@petersmartlink.com</a></div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
