import Link from 'next/link'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'

export default function TelegramLoginPage() {
  return <main className="min-h-screen grid place-items-center px-4 py-10 bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <section className="w-full max-w-md rounded-[30px] border border-black/[.07] dark:border-white/[.10] bg-[color:var(--cosmos-surface)] p-6 sm:p-8 text-center">
      <Link href="/" aria-label="Otya home" className="inline-flex items-center gap-2 mb-7">
        <OtyaBrandMark size={42} />
        <span className="font-black text-xl">Otya</span>
      </Link>
      <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Telegram is not a sign-in method</h1>
      <p className="mt-4 text-sm leading-6 otya-muted">Sign in to your Otya Account with your email or Google. You can then link Telegram from Account → Sign-in and linked methods for notifications and owner-device confirmation.</p>
      <Link href="/sign-in" className="cosmos-button mt-7 inline-flex min-h-12 items-center justify-center rounded-full px-6 font-black">Continue to Otya sign-in</Link>
      <p className="mt-5 text-xs leading-5 otya-muted">Never enter your Otya password or email verification code into Telegram.</p>
    </section>
  </main>
}
