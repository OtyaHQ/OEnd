'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useRef, useState } from 'react'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'
import { TurnstileChallenge } from '@/components/TurnstileChallenge'

const API = '/api/account-session'
const GOOGLE_WEB_CLIENT_ID = '82776565585-obr8k53b8n6djsggissv8qne81cm3u5u.apps.googleusercontent.com'
const TERMS_VERSION = '2026-11-10'
const PRIVACY_VERSION = '2026-11-10'
const DEFAULT_AFTER_AUTH = 'https://space.petersmartlink.com/'

type Mode = 'signin' | 'register' | 'verify' | 'forgot' | 'reset' | 'twofactor' | 'owner' | 'owner-otp' | 'owner-telegram'
type Json = { error?: string; code?: string; message?: string; authenticated?: boolean; authorization_url?: string }
type AdminState = { configured?: boolean; authenticated?: boolean; accountAdmin?: boolean; error?: string }
type GoogleCredentialResponse = { credential?: string }
type GoogleApi = { accounts: { id: { initialize(input: { client_id: string; callback: (response: GoogleCredentialResponse) => void; auto_select?: boolean }): void; renderButton(element: HTMLElement, options: Record<string, unknown>): void } } }
declare global { interface Window { google?: GoogleApi } }

function accountError(data: Json, registration: boolean): string {
  if (!registration && data.error === 'Invalid email or password') {
    return 'Email/password sign-in failed. If you created this account with Google or Telegram, use that same method below. You can also choose Forgot password to add or reset a password.'
  }
  return data.error || (registration ? 'Account creation failed.' : 'Sign in failed.')
}

async function authFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch(`${API}/${path}`, { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
}

async function adminFetch(init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return fetch('/api/admin/session', { ...init, headers, credentials: 'same-origin', cache: 'no-store' })
}

function sleep(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)) }

function afterAuthDestination(): string {
  if (typeof window === 'undefined') return DEFAULT_AFTER_AUTH
  const requested = new URLSearchParams(window.location.search).get('next')?.trim() ?? ''
  if (requested.startsWith('/') && !requested.startsWith('//') && !requested.includes('\\')) return requested
  return DEFAULT_AFTER_AUTH
}

function isAdminDestination(destination: string) {
  return destination === '/admin' || destination.startsWith('/admin/')
}

export default function SignInPage() {
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [secondFactor, setSecondFactor] = useState('')
  const [useRecovery, setUseRecovery] = useState(false)
  const [terms, setTerms] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [ownerEligible, setOwnerEligible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  const registration = mode === 'register'
  const providerMode = mode === 'signin' || mode === 'register'
  const ownerMode = mode === 'owner' || mode === 'owner-otp' || mode === 'owner-telegram'
  const securityMode = mode === 'signin' || mode === 'register' || mode === 'forgot' || mode === 'reset' || mode === 'twofactor'

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const owner = params.get('owner')
    if (owner === 'verified') {
      void completeOwnerVerification()
      return
    }

    void authFetch('session').then(async response => {
      const data = await response.json().catch(() => ({})) as Json
      if (response.ok && data.authenticated) await routeAuthenticatedSession()
    }).catch(() => undefined)

    const telegram = params.get('telegram')
    if (telegram === 'signed-in') void verifySessionAndOpen()
    else if (telegram === 'not-linked') setNotice('That Telegram account is not linked yet. Sign in with your Otya account first, then connect Telegram from Space.')
    else if (telegram === 'expired') setError('Telegram sign-in expired. Please try again.')
    else if (telegram === 'error') setError('Telegram sign-in could not be completed.')
    else if (telegram === 'cancelled') setNotice('Telegram sign-in was cancelled.')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!providerMode) return
    let cancelled = false
    const setup = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return
      googleButtonRef.current.replaceChildren()
      window.google.accounts.id.initialize({ client_id: GOOGLE_WEB_CLIENT_ID, callback: response => void completeGoogle(response), auto_select: false })
      const width = Math.max(240, Math.min(googleButtonRef.current.clientWidth || 320, 360))
      window.google.accounts.id.renderButton(googleButtonRef.current, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width })
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
      script.addEventListener('error', () => setError('Google Sign-In could not be loaded. You can still use email.'), { once: true })
      document.head.appendChild(script)
    }
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, terms, privacy, marketing])

  function resetSecurityChallenge() {
    setTurnstileToken('')
    setTurnstileResetKey(value => value + 1)
  }

  function switchMode(next: Mode) {
    setMode(next); setError(''); setNotice(''); setOtp(''); setNewPassword(''); setConfirmPassword(''); setSecondFactor(''); setUseRecovery(false); resetSecurityChallenge()
  }

  function openDestination() {
    window.location.replace(afterAuthDestination())
  }

  async function beginOwnerVerification() {
    setOwnerEligible(true)
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await adminFetch({ method: 'POST', body: JSON.stringify({ action: 'start' }) })
      const data = await response.json().catch(() => ({})) as AdminState
      if (!response.ok) throw new Error(data.error || 'Owner verification could not start.')
      setMode('owner-otp')
      setNotice('Owner account recognized. Enter the single-use code sent to the verified email on this Otya account.')
    } catch (cause) {
      setMode('owner')
      setError((cause as Error).message)
    } finally { setBusy(false) }
  }

  async function routeAuthenticatedSession() {
    const destination = afterAuthDestination()
    try {
      const response = await adminFetch()
      const state = await response.json().catch(() => ({})) as AdminState
      if (!response.ok) throw new Error(state.error || 'Otya could not check account permissions.')

      if (state.accountAdmin === true || state.authenticated === true) {
        setOwnerEligible(true)
        if (state.authenticated === true) {
          openDestination()
          return true
        }
        await beginOwnerVerification()
        return true
      }

      if (isAdminDestination(destination)) {
        setOwnerEligible(false)
        setMode('owner')
        setError('This Otya account does not have Admin access.')
        return true
      }

      openDestination()
      return true
    } catch (cause) {
      if (isAdminDestination(destination)) {
        setOwnerEligible(true)
        setMode('owner')
        setError((cause as Error).message)
        return true
      }
      openDestination()
      return true
    }
  }

  async function verifySessionAndOpen() {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await authFetch('session').catch(() => null)
      if (response?.ok) {
        const data = await response.json().catch(() => ({})) as Json
        if (data.authenticated === true) {
          await routeAuthenticatedSession()
          return true
        }
      }
      if (attempt < 2) await sleep(120 * (attempt + 1))
    }
    throw new Error('Your details were accepted, but Otya could not open a secure session. Please try again.')
  }

  async function completeOwnerVerification() {
    setMode('owner-telegram')
    setOwnerEligible(true)
    setBusy(true); setError(''); setNotice('Completing owner verification…')
    try {
      const response = await adminFetch({ method: 'POST', body: JSON.stringify({ action: 'complete' }) })
      const data = await response.json().catch(() => ({})) as AdminState
      if (!response.ok) throw new Error(data.error || 'Owner verification could not be completed.')
      setNotice('Owner verified. Opening your Otya Space…')
      openDestination()
    } catch (cause) {
      setError((cause as Error).message)
      setNotice('Telegram returned to Otya, but the owner session was not completed.')
    } finally { setBusy(false) }
  }

  async function startOwnerTelegram() {
    setBusy(true); setError('')
    try {
      const query = new URLSearchParams({ mode: 'admin', return_to: 'sign-in' })
      const destination = afterAuthDestination()
      if (isAdminDestination(destination)) query.set('next', destination)
      const response = await fetch(`/api/auth/telegram/start?${query.toString()}`, { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok || !data.authorization_url) throw new Error(data.error || 'Telegram owner verification could not start.')
      setMode('owner-telegram')
      window.location.assign(data.authorization_url)
    } catch (cause) {
      setError((cause as Error).message)
      setBusy(false)
    }
  }

  async function completeGoogle(response: GoogleCredentialResponse) {
    const idToken = response.credential || ''
    if (!idToken) return setError('Google did not return a valid sign-in credential.')
    if (!turnstileToken) return setError('Complete the Cloudflare security check before continuing with Google.')
    if (registration && (!terms || !privacy)) return setError('Accept the Terms and Privacy Policy before creating your account.')
    const securityToken = turnstileToken
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await authFetch('google', { method: 'POST', body: JSON.stringify({ id_token: idToken, turnstile_token: securityToken, ...(registration ? { terms_accepted: true, terms_version: TERMS_VERSION, privacy_accepted: true, privacy_version: PRIVACY_VERSION, marketing_consent: marketing } : {}) }) })
      const data = await result.json().catch(() => ({})) as Json
      if (!result.ok) {
        if (result.status === 428 || data.code === 'LEGAL_ACCEPTANCE_REQUIRED') {
          setMode('register')
          throw new Error('This Google account is new to Otya. Accept the Terms and Privacy Policy, then use Google again.')
        }
        throw new Error(data.error || 'Google Sign-In failed.')
      }
      await verifySessionAndOpen()
    } catch (cause) { setError((cause as Error).message) }
    finally { resetSecurityChallenge(); setBusy(false) }
  }

  async function startTelegram() {
    if (busy) return
    if (!turnstileToken) return setError('Complete the Cloudflare security check before continuing with Telegram.')
    const securityToken = turnstileToken
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/auth/telegram/start?mode=login', {
        method: 'POST',
        headers: { 'X-Otya-Turnstile': securityToken },
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok || !data.authorization_url) throw new Error(data.error || 'Telegram Sign-In is temporarily unavailable.')
      window.location.assign(data.authorization_url)
    } catch (cause) { setError((cause as Error).message); setBusy(false) }
    finally { resetSecurityChallenge() }
  }

  async function resendVerification() {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await authFetch('send-verification', { method: 'POST' })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok) throw new Error(data.error || 'Could not send a new verification code.')
      setNotice('A new verification code was sent. Only the newest code will work.')
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'owner-otp' && !otp.trim()) return setError('Enter the owner verification code from your email.')
    if (!ownerMode && !email.trim()) return setError('Enter your email address.')
    if ((mode === 'signin' || mode === 'register' || mode === 'twofactor') && !password) return setError('Enter your password.')
    if (registration && (!terms || !privacy)) return setError('Accept the Terms and Privacy Policy to create your account.')
    if (mode === 'verify' && !otp.trim()) return setError('Enter the verification code from your email.')
    if (mode === 'twofactor' && !secondFactor.trim()) return setError(useRecovery ? 'Enter a recovery code.' : 'Enter your authenticator code.')
    if (mode === 'reset' && (!otp.trim() || newPassword.length < 8)) return setError('Enter the reset code and a new password of at least 8 characters.')
    if (mode === 'reset' && newPassword !== confirmPassword) return setError('The new passwords do not match.')
    if (securityMode && !turnstileToken) return setError('Complete the Cloudflare security check before continuing.')

    const protectedSubmit = securityMode
    const securityToken = protectedSubmit ? turnstileToken : ''
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'owner-otp') {
        const response = await adminFetch({ method: 'POST', body: JSON.stringify({ action: 'verify-otp', otp: otp.trim().toUpperCase() }) })
        const data = await response.json().catch(() => ({})) as AdminState
        if (!response.ok) throw new Error(data.error || 'The owner verification code is invalid or expired.')
        setOtp('')
        setNotice('Email verification passed. Continue with the Telegram identity linked to this same Otya account.')
        setBusy(false)
        await startOwnerTelegram()
        return
      }
      if (mode === 'verify') {
        const response = await authFetch('verify-email', { method: 'POST', body: JSON.stringify({ otp: otp.trim().toUpperCase() }) })
        const data = await response.json().catch(() => ({})) as Json
        if (!response.ok) throw new Error(data.error || 'The verification code is invalid or expired.')
        setOtp('')
        await verifySessionAndOpen()
        return
      }
      if (mode === 'forgot') {
        const response = await authFetch('forgot-password', { method: 'POST', body: JSON.stringify({ email: email.trim(), turnstile_token: securityToken }) })
        const data = await response.json().catch(() => ({})) as Json
        if (!response.ok) throw new Error(data.error || 'Could not request a password reset.')
        setNotice(data.message || 'If that account exists, a reset code has been requested.')
        setMode('reset')
        return
      }
      if (mode === 'reset') {
        const response = await authFetch('reset-password', { method: 'POST', body: JSON.stringify({ email: email.trim(), otp: otp.trim(), new_password: newPassword, turnstile_token: securityToken }) })
        const data = await response.json().catch(() => ({})) as Json
        if (!response.ok) throw new Error(data.error || 'Could not reset your password.')
        setPassword(''); setNewPassword(''); setConfirmPassword(''); setOtp(''); setMode('signin')
        setNotice(data.message || 'Password updated. Sign in with your new password.')
        return
      }

      const endpoint = registration ? 'register' : 'login'
      const payload = registration
        ? { email: email.trim(), password, name: name.trim() || undefined, terms_accepted: true, terms_version: TERMS_VERSION, privacy_accepted: true, privacy_version: PRIVACY_VERSION, marketing_consent: marketing, turnstile_token: securityToken }
        : { email: email.trim(), password, turnstile_token: securityToken, ...(mode === 'twofactor' && !useRecovery ? { totp_code: secondFactor.trim() } : {}), ...(mode === 'twofactor' && useRecovery ? { recovery_code: secondFactor.trim() } : {}) }
      const response = await authFetch(endpoint, { method: 'POST', body: JSON.stringify(payload) })
      const data = await response.json().catch(() => ({})) as Json
      if (!response.ok) {
        if (data.code === 'TWO_FACTOR_REQUIRED' || data.code === 'TWO_FACTOR_INVALID') {
          setMode('twofactor'); setSecondFactor('')
          throw new Error(data.error || 'Two-step verification is required.')
        }
        throw new Error(accountError(data, registration))
      }
      if (registration) {
        setPassword('')
        setOtp('')
        setMode('verify')
        setNotice('Account created. We sent one verification code to your email. Enter it below to finish setup.')
        return
      }
      await verifySessionAndOpen()
    } catch (cause) { setError((cause as Error).message) }
    finally { if (protectedSubmit) resetSecurityChallenge(); setBusy(false) }
  }

  const title = mode === 'register' ? 'Create your Otya account' : mode === 'verify' ? 'Verify your email' : mode === 'twofactor' ? 'Confirm it’s you' : mode === 'forgot' ? 'Reset your password' : mode === 'reset' ? 'Choose a new password' : mode === 'owner-otp' ? 'Confirm owner access' : mode === 'owner-telegram' ? 'Confirm owner identity' : mode === 'owner' ? 'Owner access' : 'Sign in to Otya'
  const subtitle = mode === 'verify' ? `Enter the 5-character code sent to ${email || 'your email'}.` : mode === 'twofactor' ? 'Use your authenticator or a recovery code.' : mode === 'forgot' ? 'Enter your email to request a reset code.' : mode === 'reset' ? 'Enter the code from your email and choose a new password.' : mode === 'owner-otp' ? 'This is the same Otya account. Enter the fresh code sent to its verified owner email.' : mode === 'owner-telegram' ? 'Finish the owner check with the Telegram identity linked to this same Otya account.' : mode === 'owner' ? 'Admin is a role inside this Otya account, not a second account.' : registration ? 'Create one account for Otya.' : 'One account opens your Otya Space.'

  return <main className="otya-auth-page min-h-screen text-[color:var(--cosmos-text-primary)] grid place-items-center px-4 py-8 sm:py-12">
    <section className="w-full max-w-[460px]">
      <Link href="https://petersmartlink.com" aria-label="Otya home" className="inline-flex items-center gap-2.5 mb-8"><OtyaBrandMark size={40} /><span><span className="block font-black text-[15px] tracking-[-.03em]">Otya</span><span className="block text-[11px] otya-muted">Otya Space</span></span></Link>
      <div className="otya-auth-card rounded-[30px] border p-5 sm:p-7">
        <div className="mb-5"><OtyaBrandMark size={46}/></div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-[-.05em]">{title}</h1>
        <p className="mt-2 mb-6 text-sm leading-6 otya-muted">{subtitle}</p>
        {error && <div className="rounded-2xl border border-red-500/20 bg-red-500/[.07] px-4 py-3 mb-4 text-sm text-red-200">{error}</div>}
        {notice && <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[.07] px-4 py-3 mb-4 text-sm text-emerald-200">{notice}</div>}

        {mode === 'owner' ? <div className="space-y-3">
          {ownerEligible && <button type="button" disabled={busy} onClick={() => void beginOwnerVerification()} className="cosmos-button w-full rounded-full min-h-12 px-5 font-black disabled:opacity-55">{busy ? 'Checking…' : 'Retry owner verification'}</button>}
          <button type="button" onClick={() => window.location.replace(DEFAULT_AFTER_AUTH)} className="w-full rounded-full min-h-12 px-5 font-black border border-white/[.10]">Open Space</button>
        </div> : mode === 'owner-telegram' ? <div className="space-y-3">
          <button type="button" disabled={busy} onClick={() => void startOwnerTelegram()} className="cosmos-button w-full rounded-full min-h-12 px-5 font-black disabled:opacity-55">{busy ? 'Completing verification…' : 'Continue with Telegram'}</button>
          <button type="button" onClick={() => window.location.replace(DEFAULT_AFTER_AUTH)} className="w-full rounded-full min-h-12 px-5 font-black border border-white/[.10]">Open Space</button>
        </div> : <form onSubmit={submit} className="space-y-3">
          {registration && <Field value={name} onChange={setName} placeholder="Name" autoComplete="name" />}
          {!ownerMode && <Field value={email} onChange={setEmail} placeholder="Email" type="email" autoComplete="email" disabled={mode === 'twofactor' || mode === 'reset' || mode === 'verify'} />}
          {(mode === 'signin' || mode === 'register' || mode === 'twofactor') && <Field value={password} onChange={setPassword} placeholder="Password" type="password" autoComplete={registration ? 'new-password' : 'current-password'} disabled={mode === 'twofactor'} />}
          {(mode === 'verify' || mode === 'owner-otp') && <Field value={otp} onChange={value => setOtp(value.toUpperCase())} placeholder="A1234" autoComplete="one-time-code" autoFocus />}
          {mode === 'twofactor' && <><Field value={secondFactor} onChange={setSecondFactor} placeholder={useRecovery ? 'Recovery code' : '6-digit authenticator code'} autoFocus/><button type="button" onClick={() => { setUseRecovery(value => !value); setSecondFactor(''); setError('') }} className="w-full py-1 text-sm font-bold otya-muted">{useRecovery ? 'Use authenticator code instead' : 'Use a recovery code instead'}</button></>}
          {mode === 'reset' && <><Field value={otp} onChange={setOtp} placeholder="Reset code" autoComplete="one-time-code"/><Field value={newPassword} onChange={setNewPassword} placeholder="New password" type="password" autoComplete="new-password"/><Field value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" type="password" autoComplete="new-password"/></>}
          {registration && <div className="space-y-3 py-2 text-sm otya-muted"><Check checked={terms} onChange={setTerms}>I accept the <Link href="/terms" className="font-black text-[color:var(--cosmos-text-primary)]">Terms</Link>.</Check><Check checked={privacy} onChange={setPrivacy}>I accept the <Link href="/privacy" className="font-black text-[color:var(--cosmos-text-primary)]">Privacy Policy</Link>.</Check><Check checked={marketing} onChange={setMarketing}>Send me optional Otya product news.</Check></div>}
          {securityMode && <TurnstileChallenge onTokenChange={setTurnstileToken} resetKey={turnstileResetKey} />}
          <button disabled={busy} className="cosmos-button w-full rounded-full min-h-12 px-5 font-black disabled:opacity-55">{busy ? 'Please wait…' : mode === 'register' ? 'Create account' : mode === 'verify' ? 'Verify and continue' : mode === 'twofactor' ? 'Verify and sign in' : mode === 'forgot' ? 'Request reset code' : mode === 'reset' ? 'Update password' : mode === 'owner-otp' ? 'Verify owner and continue' : 'Sign in'}</button>
        </form>}

        {!ownerMode && <div className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm font-bold otya-muted">
          {mode === 'signin' && <><button type="button" onClick={() => switchMode('register')}>Create account</button><button type="button" onClick={() => switchMode('forgot')}>Forgot password?</button></>}
          {mode === 'register' && <button type="button" onClick={() => switchMode('signin')}>Already have an account?</button>}
          {mode === 'verify' && <><button type="button" disabled={busy} onClick={() => void resendVerification()}>Resend code</button><button type="button" onClick={() => switchMode('signin')}>Back to sign in</button></>}
          {(mode === 'forgot' || mode === 'reset' || mode === 'twofactor') && <button type="button" onClick={() => switchMode('signin')}>Back to sign in</button>}
        </div>}
        {providerMode && <div className="mt-7 border-t border-white/[.08] pt-5">
          <p className="mb-2 text-center text-[11px] font-bold tracking-wide otya-muted">OTHER WAYS TO CONTINUE</p>
          <p className="mx-auto mb-4 max-w-sm text-center text-xs leading-5 otya-muted">Use the method you chose when creating your account. Google or Telegram accounts may not have an Otya password yet.</p>
          <div className={`space-y-3 ${busy || !turnstileToken ? 'pointer-events-none opacity-55' : ''}`}>
            <div ref={googleButtonRef} className="min-h-11 w-full flex items-center justify-center overflow-hidden rounded-full" aria-label="Continue with Google" title="Continue with Google" />
            <button type="button" onClick={() => void startTelegram()} disabled={busy || !turnstileToken} aria-label="Continue with Telegram" title="Continue with Telegram" className="w-full min-h-11 inline-flex items-center justify-center gap-2.5 rounded-full border border-white/[.10] bg-transparent px-5 text-sm font-bold disabled:opacity-35"><svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><path d="M21.6 3.5 18.7 20c-.2 1.2-.8 1.5-1.7.9l-4.5-3.3-2.2 2.1c-.2.2-.4.4-.8.4l.3-4.6 8.4-7.6c.4-.3-.1-.5-.6-.2L7.2 14.2 2.7 12.8c-1-.3-1-1 .2-1.5L20.4 4.5c.8-.3 1.5.2 1.2-1z"/></svg><span>Continue with Telegram</span></button>
          </div>
        </div>}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs otya-muted"><Link href="https://petersmartlink.com/terms">Terms</Link><Link href="https://petersmartlink.com/privacy">Privacy</Link><Link href="https://docs.petersmartlink.com">Help & Docs</Link></div>
    </section>
  </main>
}

function Field({ value, onChange, placeholder, type = 'text', autoComplete, disabled, autoFocus }: { value: string; onChange: (value: string) => void; placeholder: string; type?: string; autoComplete?: string; disabled?: boolean; autoFocus?: boolean }) { return <input value={value} onChange={event => onChange(event.target.value)} type={type} placeholder={placeholder} autoComplete={autoComplete} disabled={disabled} autoFocus={autoFocus} className="w-full min-h-12 rounded-2xl border border-white/[.10] px-4 outline-none bg-[color:var(--cosmos-surface-elevated)] placeholder:text-white/35 disabled:opacity-50 focus:border-[color:var(--cosmos-primary)] focus:shadow-[0_0_0_3px_rgba(39,232,255,.10)]" /> }
function Check({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) { return <label className="flex gap-3 items-start"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-1 accent-[color:var(--cosmos-primary)]"/><span>{children}</span></label> }
