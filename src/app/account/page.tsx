'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'

const API = '/api/account-session'

type User = {
  id?: string
  otya_id?: string | null
  email: string | null
  name?: string | null
  avatar_url?: string | null
  is_verified?: boolean | number
  recovery_email?: string | null
  country_code?: string | null
  locale?: string | null
  timezone?: string | null
}

type Identity = { provider: string; provider_username?: string | null }
type Payload = { user?: User; identities?: Identity[]; error?: string; message?: string; sign_in_again?: boolean; session_revocation_complete?: boolean }

async function accountFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${API}/${path}`, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
}

export default function AccountPage() {
  const [user, setUser] = useState<User | null>(null)
  const [identities, setIdentities] = useState<Identity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [currentEmailChangeCode, setCurrentEmailChangeCode] = useState('')
  const [newEmailChangeCode, setNewEmailChangeCode] = useState('')
  const [emailChangePending, setEmailChangePending] = useState(false)
  const [emailChanging, setEmailChanging] = useState(false)
  const [mustSignIn, setMustSignIn] = useState(false)
  const [sessionsRevoked, setSessionsRevoked] = useState<boolean | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const response = await accountFetch('account')
      const data = await response.json().catch(() => ({})) as Payload
      if (!response.ok || !data.user) throw new Error(data.error || 'Could not load your Otya account.')
      setUser(data.user)
      setIdentities(Array.isArray(data.identities) ? data.identities : [])
      setName(data.user.name || '')
      setRecoveryEmail(data.user.recovery_email || '')
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (saving) return
    setSaving(true); setError(''); setNotice('')
    try {
      const response = await accountFetch('account', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim() || null,
          recovery_email: recoveryEmail.trim() || null,
        }),
      })
      const data = await response.json().catch(() => ({})) as Payload
      if (!response.ok) throw new Error(data.error || 'Could not save your account.')
      setNotice('Account details saved.')
      await load()
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function requestEmailChange(event: FormEvent) {
    event.preventDefault()
    if (emailChanging) return
    if (!newEmail.trim()) {
      setError('Enter the new primary email address.')
      return
    }
    setEmailChanging(true); setError(''); setNotice('')
    try {
      const response = await accountFetch('email-change/request', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail.trim() }),
      })
      const data = await response.json().catch(() => ({})) as Payload
      if (!response.ok) throw new Error(data.error || 'Could not request an email change.')
      setEmailChangePending(true)
      setCurrentEmailChangeCode('')
      setNewEmailChangeCode('')
      setNotice(data.message || 'A security code was sent to your linked Telegram bot chat and another to your new email.')
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setEmailChanging(false)
    }
  }

  async function confirmEmailChange(event: FormEvent) {
    event.preventDefault()
    if (emailChanging) return
    if (!currentEmailChangeCode.trim() || !newEmailChangeCode.trim()) {
      setError('Enter both verification codes: one from your linked OtyaPlayerBot private chat and one from your new email.')
      return
    }
    setEmailChanging(true); setError(''); setNotice('')
    try {
      const response = await accountFetch('email-change/confirm', {
        method: 'POST',
        body: JSON.stringify({
          current_otp: currentEmailChangeCode.trim().toUpperCase(),
          new_otp: newEmailChangeCode.trim().toUpperCase(),
        }),
      })
      const data = await response.json().catch(() => ({})) as Payload
      if (!response.ok) {
        setSessionsRevoked(data.session_revocation_complete === true)
        setMustSignIn(typeof data.session_revocation_complete === 'boolean')
        if (data.message) setNotice(data.message)
        throw new Error(data.error || 'Could not verify the new email address.')
      }
      const verifiedEmail = newEmail.trim().toLowerCase()
      setUser(current => current ? { ...current, email: verifiedEmail, is_verified: 1 } : current)
      setEmailChangePending(false)
      setNewEmail('')
      setCurrentEmailChangeCode('')
      setNewEmailChangeCode('')
      setMustSignIn(data.sign_in_again === true)
      setSessionsRevoked(data.session_revocation_complete === true)
      setNotice(data.message || 'Your Otya primary email has been updated.')
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setEmailChanging(false)
    }
  }

  const publicId = user?.otya_id?.toUpperCase()
  const signInMethodCount = [Boolean(user?.email), identities.some(identity => identity.provider === 'google')].filter(Boolean).length
  const base = publicId ? `/u/${publicId}` : ''
  const emailStatus = !user?.email ? 'No primary email' : user.is_verified ? 'Verified' : 'Verification required'

  return <main className="px-4 sm:px-7 lg:px-10 py-7 sm:py-9 max-w-[980px]">
    <header className="mb-7">
      <div className="text-[11px] font-black uppercase tracking-[.16em] otya-muted">Otya Space · Account</div>
      <h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-[-.045em]">Account overview</h1>
      <p className="mt-2 text-sm sm:text-base otya-muted">Your identity and profile only. Security, devices, providers and preferences now have their own pages.</p>
    </header>

    {error && <div className="mb-5 rounded-2xl border border-red-500/25 px-4 py-3 text-sm text-red-700 dark:text-red-200">{error}</div>}
    {notice && <div className="mb-5 rounded-2xl border border-emerald-500/25 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200">{notice}</div>}
    {mustSignIn && <div className="mb-5 rounded-2xl border p-4 text-sm" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
      <p>Your Otya ID and linked sign-in methods were preserved. {sessionsRevoked ? 'All refresh sessions were revoked for security.' : 'Your browser session was closed, but we could not confirm that every other session was revoked; contact Otya Support.'} Sign in again using the Google account or email credentials already connected to your Otya ID.</p>
      <Link href="/sign-in" className="mt-3 inline-flex font-black underline underline-offset-4">Continue to sign in</Link>
    </div>}

    {loading && !user ? <AccountSkeleton /> : <>
      <section className="grid sm:grid-cols-3 gap-3 mb-6">
        <Summary label="Otya ID" value={publicId || 'Preparing…'} mono />
        <Summary label="Email" value={emailStatus} />
        <Summary label="Sign-in methods" value={String(signInMethodCount)} />
      </section>

      <section className="rounded-[24px] border p-5 sm:p-6" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
        <div className="mb-5"><h2 className="text-xl font-black">Profile</h2><p className="mt-1 text-sm otya-muted">These details belong to your Otya account, not to a separate Space identity.</p></div>
        <form onSubmit={save} className="grid gap-4">
          <Field label="Name" value={name} onChange={setName} autoComplete="name" placeholder="Your name" />
          <Field label="Primary email" value={user?.email || ''} disabled placeholder="No primary email added" />
          <Field label="Recovery email" value={recoveryEmail} onChange={setRecoveryEmail} type="email" autoComplete="email" placeholder="Optional recovery email" />
          <div className="flex flex-wrap gap-2 pt-1">
            <button disabled={saving} className="cosmos-button min-h-11 rounded-xl px-5 text-sm font-black disabled:opacity-60">{saving ? 'Saving…' : 'Save profile'}</button>
            {!user?.is_verified && user?.email && <Link href={`${base}/security`} className="otya-quiet-button inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black">Verify email</Link>}
          </div>
        </form>
      </section>

      {user?.email && Number(user.is_verified) === 1 && <section className="mt-6 rounded-[24px] border p-5 sm:p-6" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
        <div className="mb-4">
          <h2 className="text-xl font-black">Change primary email</h2>
          <p className="mt-1 text-sm otya-muted">To protect your existing account, Otya sends one code to your linked private OtyaPlayerBot chat to prove control of the current account, and another code to your new email. Both must be confirmed. Your Otya ID, profile and Google sign-in stay attached to the same account; Telegram remains a separate security and OTP channel.</p>
        </div>
        <form onSubmit={requestEmailChange} className="grid gap-3">
          <Field label="New primary email" value={newEmail} onChange={setNewEmail} type="email" autoComplete="email" placeholder="otyaug@gmail.com" disabled={emailChanging || emailChangePending || mustSignIn} />
          <button disabled={emailChanging || emailChangePending || mustSignIn} className="cosmos-button min-h-11 justify-center rounded-xl px-5 text-sm font-black disabled:opacity-60">
            {emailChanging ? 'Sending code…' : 'Send verification code'}
          </button>
        </form>
        {emailChangePending && <form onSubmit={confirmEmailChange} className="mt-4 grid gap-3 border-t pt-4" style={{ borderColor: 'var(--cosmos-divider)' }}>
          <p className="text-sm otya-muted">Enter both 5-character codes: one from your OtyaPlayerBot private chat and one from your new email. Each expires after 10 minutes.</p>
          <Field label="Code sent to your linked Otya Telegram bot chat" value={currentEmailChangeCode} onChange={value => setCurrentEmailChangeCode(value.toUpperCase())} placeholder="A1234" autoComplete="one-time-code" />
          <Field label={`Code sent to your new email (${newEmail.trim()})`} value={newEmailChangeCode} onChange={value => setNewEmailChangeCode(value.toUpperCase())} placeholder="B5678" autoComplete="one-time-code" />
          <div className="flex flex-wrap gap-2">
            <button disabled={emailChanging} className="cosmos-button min-h-11 rounded-xl px-5 text-sm font-black disabled:opacity-60">{emailChanging ? 'Verifying…' : 'Verify and update email'}</button>
            <button type="button" disabled={emailChanging} onClick={() => { setEmailChangePending(false); setCurrentEmailChangeCode(''); setNewEmailChangeCode('') }} className="otya-quiet-button min-h-11 rounded-xl px-4 text-sm font-black disabled:opacity-60">Cancel</button>
          </div>
        </form>}
      </section>}

      <section className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <SectionLink href={`${base}/security`} title="Security" text="Email verification, two-step verification and recovery." />
        <SectionLink href={`${base}/devices`} title="Devices & sessions" text="Review and revoke active sessions." />
        <SectionLink href={`${base}/providers`} title="Sign-in methods" text="Email and Google for sign-in; Telegram for security verification and OTP delivery." />
        <SectionLink href={`${base}/settings`} title="Preferences" text="Locale, timezone and account preferences." />
        <SectionLink href={`${base}/activity`} title="Activity" text="Review recent account session activity." />
        <SectionLink href={`${base}/storage`} title="Data & recovery" text="Understand device-first data and supported backups." />
      </section>
    </>}
  </main>
}

function Summary({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="rounded-[20px] border p-4" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}><div className="text-[10px] font-black uppercase tracking-[.14em] otya-muted">{label}</div><div className={`mt-2 text-base font-black break-all ${mono ? 'font-mono' : ''}`}>{value}</div></div>
}

function Field({ label, value, onChange, type = 'text', autoComplete, placeholder, disabled = false }: { label: string; value: string; onChange?: (value: string) => void; type?: string; autoComplete?: string; placeholder?: string; disabled?: boolean }) {
  return <label className="grid gap-1.5"><span className="text-xs font-black otya-muted">{label}</span><input value={value} onChange={event => onChange?.(event.target.value)} type={type} autoComplete={autoComplete} placeholder={placeholder} disabled={disabled} className="min-h-12 rounded-xl border bg-transparent px-3.5 text-sm outline-none disabled:opacity-60" style={{ borderColor: 'var(--cosmos-divider)' }} /></label>
}

function SectionLink({ href, title, text }: { href: string; title: string; text: string }) {
  return <Link href={href || '#'} className="rounded-[20px] border p-4 transition hover:-translate-y-0.5" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}><div className="font-black">{title}</div><p className="mt-1 text-xs leading-5 otya-muted">{text}</p><div className="mt-3 text-xs font-black">Open →</div></Link>
}

function AccountSkeleton() {
  return <div className="space-y-3"><div className="h-24 rounded-[20px] animate-pulse" style={{ background: 'var(--cosmos-card)' }} /><div className="h-64 rounded-[24px] animate-pulse" style={{ background: 'var(--cosmos-card)' }} /></div>
}
