'use client'

import { useCallback, useEffect, useState } from 'react'

type ConnectionStatus = {
  gmail?: { configured?: boolean; connected?: boolean; email?: string | null }
  resend?: { configured?: boolean }
  support_inbox?: { provider?: string; connected?: boolean }
}

export default function ConnectionsClient() {
  const [status, setStatus] = useState<ConnectionStatus>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/ai/connectors/status', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || data.error || `HTTP ${response.status}`)
      setStatus(data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check connections')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function connectGmail() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/admin/ai/connectors/gmail/start', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.authorization_url) throw new Error(data.detail || data.error || 'Could not start Google authorization')
      window.location.assign(data.authorization_url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not connect Gmail')
      setBusy(false)
    }
  }

  const gmailConnected = status.gmail?.connected === true
  const gmailReady = status.gmail?.configured === true

  return <section className="mt-10">
    <div className="flex items-end justify-between gap-3">
      <div>
        <div className="otya-kicker mb-2">Live connections</div>
        <h2 className="text-2xl font-black tracking-[-.03em]">Email services</h2>
      </div>
      <button type="button" onClick={() => void refresh()} disabled={loading} className="otya-quiet-button min-h-10 rounded-xl px-3 text-sm font-bold disabled:opacity-50">Refresh</button>
    </div>

    {error && <p className="mt-4 rounded-xl border px-4 py-3 text-sm text-red-500" style={{ borderColor: 'var(--cosmos-divider)' }}>{error}</p>}

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <article className="rounded-2xl border p-5" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
        <div className="flex items-center justify-between gap-3"><h3 className="font-black">Resend</h3><span className="text-xs font-bold">{loading ? 'Checking…' : status.resend?.configured ? 'Connected' : 'Setup required'}</span></div>
        <p className="mt-2 text-sm leading-6 otya-muted">Sends verification codes, security alerts, release reports and approved support replies. The API key stays in Cloudflare.</p>
      </article>

      <article className="rounded-2xl border p-5" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
        <div className="flex items-center justify-between gap-3"><h3 className="font-black">Support Gmail</h3><span className="text-xs font-bold">{loading ? 'Checking…' : gmailConnected ? 'Connected' : gmailReady ? 'Ready to connect' : 'Setup required'}</span></div>
        <p className="mt-2 text-sm leading-6 otya-muted">Reads mail forwarded to support@otya.site for the private O support inbox. Sending remains approval-gated.</p>
        {gmailConnected ? <p className="mt-3 text-xs otya-muted">Connected{status.gmail?.email ? ` as ${status.gmail.email}` : ''}.</p> : <button type="button" onClick={() => void connectGmail()} disabled={!gmailReady || busy || loading} className="cosmos-button mt-4 min-h-11 rounded-xl px-4 text-sm font-black disabled:opacity-50">{busy ? 'Opening Google…' : 'Connect Gmail'}</button>}
      </article>
    </div>
  </section>
}
