'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'

function validWidgetAuthUrl(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (
      url.protocol !== 'https:'
      || url.hostname !== 'petersmartlink.com'
      || url.pathname !== '/api/auth/telegram/widget/callback'
      || !url.searchParams.get('state')
    ) return null
    return url.toString()
  } catch {
    return null
  }
}

export default function TelegramLoginPage() {
  const widgetRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const bot = params.get('bot') || ''
    const authUrl = validWidgetAuthUrl(params.get('auth') || '')
    if (!/^[A-Za-z0-9_]{5,32}$/.test(bot) || !authUrl || !widgetRef.current) {
      setError('Telegram account linking could not be prepared safely. Return to OTYA and try again.')
      return
    }

    const host = widgetRef.current
    host.replaceChildren()
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', bot)
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-radius', '14')
    script.setAttribute('data-auth-url', authUrl)
    script.setAttribute('data-request-access', 'write')
    script.addEventListener('error', () => setError('Telegram could not be loaded. Check your connection and try again.'), { once: true })
    host.appendChild(script)
    return () => host.replaceChildren()
  }, [])

  return <main className="min-h-screen grid place-items-center px-4 py-10 bg-[color:var(--cosmos-scaffold)] text-[color:var(--cosmos-text-primary)]">
    <section className="w-full max-w-[460px]">
      <Link href="/" aria-label="OTYA home" className="inline-flex items-center gap-1.5 mb-8">
        <OtyaBrandMark size={42} />
        <span className="font-black text-[22px] tracking-[-.05em]">tya</span>
      </Link>

      <div className="rounded-[30px] border border-black/[.07] dark:border-white/[.10] bg-[color:var(--cosmos-surface)] p-6 sm:p-8 shadow-[0_24px_80px_rgba(20,16,35,.09)] text-center">
        <div className="mx-auto h-14 w-14 rounded-full grid place-items-center bg-[#229ED9]/10 text-[#229ED9] mb-5" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-7 w-7 fill-current"><path d="M21.6 3.5 18.7 20c-.2 1.2-.8 1.5-1.7.9l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.8.4l.3-4.6 8.4-7.6c.4-.3-.1-.5-.6-.2L7.2 14.2 2.7 12.8c-1-.3-1-1 .2-1.5L20.4 4.5c.8-.3 1.5.2 1.2-1z"/></svg>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-.05em]">Connect Telegram</h1>
        <p className="mt-3 text-sm leading-6 otya-muted">Connect Telegram only after signing in to your existing Otya account with email or Google. Telegram cannot create an account or sign in to Otya.</p>

        {error ? <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[.07] px-4 py-3 text-sm text-red-700 dark:text-red-200">{error}</div> : <div ref={widgetRef} className="mt-7 min-h-12 flex items-center justify-center" aria-label="Telegram account linking" />}

        <div className="mt-7 border-t border-black/[.06] dark:border-white/[.08] pt-5 text-xs leading-5 otya-muted">
          Telegram is a linked channel, not a sign-in method. Never share an Otya password or one-time code with anyone. Sign in with email or Google first, then connect Telegram from Account settings.
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-5 text-xs otya-muted">
        <Link href="/sign-in">Back to sign in</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/help">Help</Link>
      </div>
    </section>
  </main>
}
