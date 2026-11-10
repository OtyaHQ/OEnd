'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

const API = '/api/account-session'
const GOOGLE_WEB_CLIENT_ID = '82776565585-obr8k53b8n6djsggissv8qne81cm3u5u.apps.googleusercontent.com'

type User = {
  id?: string
  otya_id?: string | null
  email?: string | null
  is_verified?: boolean | number
}

type Identity = { provider: string; provider_username?: string | null }
type Json = { error?: string; user?: User; identities?: Identity[]; bot_url?: string; authorization_url?: string; email_verification_required?: boolean; identity_link_authorized?: boolean; message?: string }
type GoogleCredentialResponse = { credential?: string }
type GoogleApi = { accounts: { id: { initialize(input: { client_id: string; callback: (response: GoogleCredentialResponse) => void; auto_select?: boolean }): void; renderButton(element: HTMLElement, options: Record<string, unknown>): void } } }
declare global { interface Window { google?: GoogleApi } }

async function accountFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${API}/${path}`, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
}

export default function SignInMethodsPage() {
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const [user, setUser] = useState<User | null>(null)
  const [identities, setIdentities] = useState<Identity[]>([])
  const [primaryEmail, setPrimaryEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [telegramLinkCode, setTelegramLinkCode] = useState('')
  const [telegramLinkPending, setTelegramLinkPending] = useState(false)
  const [telegramIdentityCode, setTelegramIdentityCode] = useState('')
  const [telegramIdentityPending, setTelegramIdentityPending] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const google = identities.find(identity => identity.provider === 'google')
  const telegramOtp = identities.find(identity => identity.provider === 'telegram_otp_bot')
  const legacyTelegram = identities.find(identity => identity.provider === 'telegram')

  useEffect(() => { void loadAccount() }, [])

  useEffect(() => {
    if (!user || google) return
    let cancelled = false
    const setup = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return
      googleButtonRef.current.replaceChildren()
      window.google.accounts.id.initialize({
        client_id: GOOGLE_WEB_CLIENT_ID,
        callback: response => void connectGoogle(response),
        auto_select: false,
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 260,
      })
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-otya-google]')
    if (existing) {
      if (window.google) setup()
      else existing.addEventListener('load', setup, { once: true })
    } else {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.dataset.otyaGoogle = 'true'
      script.addEventListener('load', setup, { once: true })
      script.addEventListener('error', () => setError('Google could not be loaded. You can still use your other OTYA sign-in methods.'), { once: true })
      document.head.appendChild(script)
    }

    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, Boolean(google)])

  async function loadAccount() {
    const response = await accountFetch('account')
    const data = await response.json().catch(() => ({})) as Json
    if (!response.ok || !data.user) {
      setError(data.error || 'Could not load your OTYA account.')
      return
    }
    setUser(data.user)
    setIdentities(Array.isArray(data.identities) ? data.identities : [])
    setPrimaryEmail(data.user.email || '')
  }

  async function action(task: () => Promise<string>) {
    setBusy(true)
    setError('')
    setNotice('')
    try { setNotice(await task()) }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  async function addPrimaryEmail() {
    const email = primaryEmail.trim().toLowerCase()
    if (!email) return setError('Enter the email you want to add to this OTYA account.')

    await action(async () => {
      const response = await accountFetch('account', { method: 'PATCH', body: JSON.stringify({ email }) })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok) throw new Error(data.error || 'Could not add that email.')
      await loadAccount()

      const verification = await accountFetch('send-verification', { method: 'POST' })
      const verificationData = await verification.json().catch(() => ({})) as Json
      if (!verification.ok) throw new Error(verificationData.error || 'Email was added, but OTYA could not send the verification code. Use Send code to try again.')
      return 'Email added to this OTYA account. Check your inbox for the verification code.'
    })
  }

  async function sendEmailCode() {
    await action(async () => {
      const response = await accountFetch('send-verification', { method: 'POST' })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok) throw new Error(data.error || 'Could not send a verification code.')
      return 'Verification code sent.'
    })
  }

  async function verifyEmail() {
    if (!emailCode.trim()) return setError('Enter the verification code from your email.')
    await action(async () => {
      const response = await accountFetch('verify-email', { method: 'POST', body: JSON.stringify({ otp: emailCode.trim() }) })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok) throw new Error(data.error || 'Could not verify your email.')
      setEmailCode('')
      await loadAccount()
      return 'Your email is now verified on this OTYA account.'
    })
  }

  async function connectGoogle(response: GoogleCredentialResponse) {
    const idToken = response.credential || ''
    if (!idToken) return setError('Google did not return a valid credential.')

    await action(async () => {
      const result = await accountFetch('google/link', { method: 'POST', body: JSON.stringify({ id_token: idToken }) })
      const data = await result.json().catch(() => ({})) as Json
      if (!result.ok) throw new Error(data.error || 'Could not connect Google to this OTYA account.')
      await loadAccount()
      return 'Google is now connected to this same OTYA account.'
    })
  }

  async function connectTelegramOtp() {
    await action(async () => {
      const response = await accountFetch('telegram-otp/link/start', { method: 'POST' })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok || data.email_verification_required !== true) {
        throw new Error(data.error || 'Could not start the secure Telegram connection.')
      }
      setTelegramLinkCode('')
      setTelegramLinkPending(true)
      return data.message || `A verification code was sent to ${user?.email || 'your current email'}. Confirm it before opening OtyaPlayerBot.`
    })
  }

  async function verifyTelegramOtpEmail() {
    if (!telegramLinkCode.trim()) return setError('Enter the code sent to your current verified Otya email.')
    await action(async () => {
      const response = await accountFetch('telegram-otp/link/verify', {
        method: 'POST',
        body: JSON.stringify({ otp: telegramLinkCode.trim().toUpperCase() }),
      })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok || !data.bot_url) throw new Error(data.error || 'The email proof could not be confirmed.')
      setTelegramLinkPending(false)
      setTelegramLinkCode('')
      window.location.assign(data.bot_url)
      return 'Email ownership verified. Open OtyaPlayerBot and press Start to finish linking.'
    })
  }

  async function connectTelegramIdentity() {
    await action(async () => {
      const response = await accountFetch('telegram-identity/link/start', { method: 'POST' })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok || data.email_verification_required !== true) {
        throw new Error(data.error || 'Could not start the owner-verification Telegram connection.')
      }
      setTelegramIdentityCode('')
      setTelegramIdentityPending(true)
      return data.message || `A proof code was sent to ${user?.email || 'your current verified email'}.`
    })
  }

  async function verifyTelegramIdentityEmail() {
    if (!telegramIdentityCode.trim()) {
      return setError('Enter the code sent to your current verified Otya email.')
    }
    await action(async () => {
      const response = await accountFetch('telegram-identity/link/verify', {
        method: 'POST',
        body: JSON.stringify({ otp: telegramIdentityCode.trim().toUpperCase() }),
      })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok || data.identity_link_authorized !== true) {
        throw new Error(data.error || 'The current-email proof could not be confirmed.')
      }

      const start = await fetch('/api/auth/telegram/start?mode=link', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const startData = await start.json().catch(() => ({})) as Json
      if (!start.ok || !startData.authorization_url) {
        throw new Error(startData.error || 'Email verified, but Telegram authorization could not start. Start again from this page.')
      }
      setTelegramIdentityPending(false)
      setTelegramIdentityCode('')
      window.location.assign(startData.authorization_url)
      return 'Email verified. Continue with Telegram to connect the owner-only security identity.'
    })
  }

  async function refreshTelegramOtpStatus() {
    await action(async () => {
      await loadAccount()
      return 'Telegram connection status refreshed.'
    })
  }

  async function disconnectTelegramOtp() {
    await action(async () => {
      const response = await accountFetch('telegram-otp/link/revoke', { method: 'POST' })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok) throw new Error(data.error || 'Could not disconnect Telegram OTP delivery.')
      await loadAccount()
      return 'Telegram OTP delivery has been disconnected.'
    })
  }

  if (!user) return <main className="px-4 sm:px-7 lg:px-10 py-8 max-w-[900px]"><p className="text-sm otya-muted">Loading sign-in methods…</p>{error && <Notice error>{error}</Notice>}</main>

  return <main className="px-4 sm:px-7 lg:px-10 py-8 max-w-[900px]">
    <div className="mb-7">
      <div className="text-[11px] font-black uppercase tracking-[.16em] otya-muted">Otya Space</div>
      <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-[-.045em]">Sign-in methods</h1>
      <p className="mt-2 text-sm sm:text-base otya-muted">Google and email are Otya sign-in methods. Telegram can be connected separately for one-time security codes; it does not sign you in.</p>
      <div className="mt-3 text-xs font-mono otya-muted">OTYA ID: {user.otya_id || 'Being assigned'}</div>
    </div>

    {error && <Notice error>{error}</Notice>}
    {notice && <Notice>{notice}</Notice>}

    <section className="rounded-[24px] border overflow-hidden" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
      <MethodRow title="Email" status={!user.email ? 'Not connected' : user.is_verified ? 'Verified' : 'Verification required'}>
        {!user.email ? <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input value={primaryEmail} onChange={event => setPrimaryEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="method-input" />
          <button onClick={() => void addPrimaryEmail()} disabled={busy} className="cosmos-button rounded-xl px-4 min-h-11 text-sm font-black">Add email</button>
        </div> : <div className="mt-3">
          <div className="font-semibold break-words">{user.email}</div>
          {!user.is_verified && <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => void sendEmailCode()} disabled={busy} className="otya-quiet-button rounded-xl px-3 min-h-10 text-sm font-bold">Send code</button>
            <input value={emailCode} onChange={event => setEmailCode(event.target.value.toUpperCase().slice(0, 5))} placeholder="A1234" autoComplete="one-time-code" className="method-input max-w-[150px]" />
            <button onClick={() => void verifyEmail()} disabled={busy} className="cosmos-button rounded-xl px-3 min-h-10 text-sm font-bold">Verify</button>
          </div>}
        </div>}
      </MethodRow>

      <MethodRow title="Google" status={google ? 'Connected' : 'Not connected'}>
        {google ? <p className="mt-3 text-sm otya-muted">You can use this Google account to access the same OTYA identity.</p> : <div className="mt-4"><div ref={googleButtonRef} className={busy ? 'pointer-events-none opacity-55' : ''} /></div>}
      </MethodRow>

      <MethodRow title="Telegram owner verification" status={legacyTelegram ? 'Connected' : 'Not connected'}>
        <div className="mt-3 space-y-3">
          <p className="text-sm otya-muted">
            This separate Telegram identity is used only for sensitive owner-security checks. It cannot sign in to Otya and is not the private bot chat used for OTP delivery. Connecting or replacing it requires a code sent to your current verified email.
          </p>
          {telegramIdentityPending ? <div className="grid gap-2">
            <label className="grid gap-1.5 text-xs font-bold otya-muted">Current email verification code ({user.email})
              <input value={telegramIdentityCode} onChange={event => setTelegramIdentityCode(event.target.value.toUpperCase().slice(0, 5))} placeholder="A1234" autoComplete="one-time-code" className="method-input" />
            </label>
            <button onClick={() => void verifyTelegramIdentityEmail()} disabled={busy} className="cosmos-button rounded-xl px-4 min-h-11 text-sm font-black">Verify email and continue to Telegram</button>
            <button onClick={() => { setTelegramIdentityPending(false); setTelegramIdentityCode('') }} disabled={busy} className="otya-quiet-button rounded-xl px-4 min-h-10 text-sm font-bold">Cancel</button>
          </div> : <button onClick={() => void connectTelegramIdentity()} disabled={busy || !user.email || Number(user.is_verified) !== 1} className="otya-quiet-button rounded-xl px-4 min-h-11 text-sm font-black">
            {legacyTelegram ? 'Replace owner-verification identity' : 'Connect owner-verification identity'}
          </button>}
        </div>
      </MethodRow>

      <MethodRow title="Telegram OTP delivery" status={telegramOtp ? 'Connected' : 'Not connected'}>
        {telegramOtp ? <div className="mt-3 space-y-3">
          <p className="text-sm otya-muted">Your private OtyaPlayerBot chat can receive one-time security codes. Telegram is not a sign-in method.</p>
          <button onClick={() => void disconnectTelegramOtp()} disabled={busy} className="otya-quiet-button rounded-xl px-4 min-h-10 text-sm font-bold">Disconnect OTP delivery</button>
        </div> : <div className="mt-3 space-y-3">
          <p className="text-sm otya-muted">{legacyTelegram ? 'Your earlier Telegram identity remains linked only for account-security verification, not sign-in. Connect the private OtyaPlayerBot chat separately to receive OTPs.' : 'Connect your private Telegram bot chat to receive Otya security codes. This does not create a Telegram sign-in option.'} Before a bot link is created or replaced, Otya sends a one-time proof code to your current verified email.</p>
          {telegramLinkPending ? <div className="grid gap-2">
            <label className="grid gap-1.5 text-xs font-bold otya-muted">Current email verification code ({user.email})
              <input value={telegramLinkCode} onChange={event => setTelegramLinkCode(event.target.value.toUpperCase().slice(0, 5))} placeholder="A1234" autoComplete="one-time-code" className="method-input" />
            </label>
            <button onClick={() => void verifyTelegramOtpEmail()} disabled={busy} className="cosmos-button rounded-xl px-4 min-h-11 text-sm font-black">Verify email and open Telegram</button>
            <button onClick={() => { setTelegramLinkPending(false); setTelegramLinkCode('') }} disabled={busy} className="otya-quiet-button rounded-xl px-4 min-h-10 text-sm font-bold">Cancel</button>
          </div> : <button onClick={() => void connectTelegramOtp()} disabled={busy || !user.email || Number(user.is_verified) !== 1} className="mt-1 otya-quiet-button rounded-xl px-4 min-h-11 text-sm font-black">Connect Telegram for OTPs</button>}
          <button onClick={() => void refreshTelegramOtpStatus()} disabled={busy} className="otya-quiet-button rounded-xl px-4 min-h-10 text-sm font-bold">Refresh connection status</button>
        </div>}
      </MethodRow>
    </section>

    <p className="mt-5 text-sm otya-muted">Google or email remains your way to sign in. Telegram bot linking only enables OTP delivery and never merges accounts or grants a sign-in session.</p>
    <Link href="/account#connected" className="inline-block mt-5 text-sm font-black">Back to account overview</Link>

    <style jsx global>{`.method-input{min-height:44px;border:1px solid var(--cosmos-divider);background:var(--cosmos-card);color:var(--cosmos-text-primary);border-radius:12px;padding:10px 12px;outline:none}.method-input:focus{border-color:var(--cosmos-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--cosmos-primary) 12%,transparent)}`}</style>
  </main>
}

function MethodRow({ title, status, children }: { title: string; status: string; children: React.ReactNode }) {
  return <div className="p-5 sm:p-6 border-b last:border-b-0" style={{ borderColor: 'var(--cosmos-divider)' }}><div className="flex items-start justify-between gap-4"><div className="font-black">{title}</div><div className="text-xs font-bold otya-muted text-right">{status}</div></div>{children}</div>
}

function Notice({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm ${error ? 'border-red-500/25 text-red-700 dark:text-red-200' : ''}`} style={!error ? { borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' } : undefined}>{children}</div>
}
