import Link from 'next/link'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'
import { PUBLIC_URLS } from '@/lib/public-urls'

export const dynamic = 'force-dynamic'

export default function TelegramPage() {
  return <main className="min-h-screen bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)] px-4 py-12">
    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
      <OtyaBrandMark size={52} />
      <p className="mt-5 text-xs font-black uppercase tracking-[.18em] otya-muted">Official Otya on Telegram</p>
      <h1 className="mt-3 text-4xl sm:text-6xl font-black tracking-[-.055em]">Otya, wherever you connect.</h1>
      <p className="mt-5 max-w-xl text-base leading-8 otya-muted">
        Follow Otya updates and use the official bot for assistance. Your Otya Account remains the secure source of identity across the ecosystem.
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        <a href="https://t.me/OtyaPlayerBot" target="_blank" rel="noopener noreferrer"
          className="cosmos-button inline-flex min-h-12 items-center justify-center rounded-full px-5 font-black">
          Open Otya Bot
        </a>
        <a href="https://t.me/otyaplayer" target="_blank" rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/[.10] dark:border-white/[.12] px-5 font-black">
          Follow Otya Channel
        </a>
      </div>

      <section className="mt-9 w-full rounded-[26px] border border-black/[.08] dark:border-white/[.10] bg-[color:var(--cosmos-surface)] p-5 sm:p-7 text-left">
        <h2 className="text-lg font-black">Telegram is not a sign-in method</h2>
        <p className="mt-2 text-sm leading-7 otya-muted">
          Sign in to Otya with your email or linked Google account. After signing in, you can link Telegram to receive optional one-time security codes and Otya notifications. A Telegram message never creates an Otya session.
        </p>
        <Link href={`${PUBLIC_URLS.space}/sign-in`} className="mt-5 inline-flex font-black underline underline-offset-4">
          Open Otya Account
        </Link>
      </section>

      <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3 text-sm font-bold otya-muted">
        <Link href={PUBLIC_URLS.primary}>Otya Home</Link>
        <Link href={PUBLIC_URLS.docs}>Documentation</Link>
        <Link href={`${PUBLIC_URLS.primary}/help`}>Help & Support</Link>
        <Link href={`${PUBLIC_URLS.primary}/privacy`}>Privacy</Link>
      </div>
    </div>
  </main>
}
