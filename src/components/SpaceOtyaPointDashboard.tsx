'use client'

import { useCallback, useEffect, useState } from 'react'

type Branch = { id: string; name: string; status?: string; is_primary?: number }
type Assignment = { work_area: string; duty_role: string; branch_id: string }
type Me = { id: string; role: string; branchId?: string | null; displayName?: string; email?: string; workAssignments?: Assignment[] }
type Product = { id: string; sku?: string; name: string; category?: string; quantity_on_hand: number; reorder_level: number }
type Summary = {
  currency?: string
  inventory?: { activeProducts: number; lowStock: number }
  retail?: { completedSales: number; completedSalesTotal: number; ledgerBalanced: boolean }
}
type Agency = {
  currency?: string
  transactions?: { count: number; providerConfirmedAmount: number; providerConfirmedCommission?: number; needsReconciliation: number; failed: number }
  recent?: Array<{ id: string; reference?: string; transaction_type: string; provider_status: string; amount: number; currency?: string; created_at: string }>
}
type Payload<T> = { data?: T; error?: string; message?: string }

async function call<T>(path: string, branchId?: string) {
  const headers = new Headers({ Accept: 'application/json' })
  if (branchId) headers.set('X-Otya-Branch-Id', branchId)
  const response = await fetch('/api/point' + path, {
    method: 'GET',
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({})) as Payload<T>
  if (response.status === 401) {
    window.location.replace('/sign-in?next=' + encodeURIComponent('/space/otyapoint'))
  }
  return { response, payload }
}

function money(value: number | undefined, currency = 'UGX') {
  return new Intl.NumberFormat('en-UG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0))
}

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-UG', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function SpaceOtyaPointDashboard() {
  const [me, setMe] = useState<Me | null>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [agency, setAgency] = useState<Agency | null>(null)
  const [error, setError] = useState('')
  const [branchError, setBranchError] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState('')

  const loadBranch = useCallback(async (selected: string, identity: Me) => {
    setBranchError('')
    setProducts([])
    setSummary(null)
    setAgency(null)
    const areas = new Set((identity.workAssignments || []).map(item => item.work_area))
    const owner = identity.role === 'SOVEREIGN'
    const tasks: Promise<void>[] = []

    if (owner || areas.has('RETAIL') || areas.has('INVENTORY')) {
      tasks.push(call<Product[]>('/api/products', selected).then(result => {
        if (result.response.ok && Array.isArray(result.payload.data)) setProducts(result.payload.data)
        else setBranchError(result.payload.error || 'Inventory data could not be loaded for this branch.')
      }).catch(() => setBranchError('Inventory data could not be loaded.')))
    }

    if (owner || areas.has('FINANCE') || areas.has('REPORTS')) {
      tasks.push(call<Summary>('/api/summary', selected).then(result => {
        if (result.response.ok && result.payload) setSummary(result.payload as Summary)
        else setBranchError(result.payload.error || 'Branch reporting is not available for this assignment.')
      }).catch(() => setBranchError('Branch reporting could not be loaded.')))
    }

    if (owner || areas.has('MOBILE_MONEY')) {
      tasks.push(call<Agency>('/api/agency-overview', selected).then(result => {
        if (result.response.ok && result.payload) setAgency(result.payload as Agency)
        else setBranchError(result.payload.error || 'Mobile Money records are not available for this assignment.')
      }).catch(() => setBranchError('Mobile Money records could not be loaded.')))
    }

    await Promise.all(tasks)
    setLastUpdated(new Date().toISOString())
  }, [])

  const bootstrap = useCallback(async () => {
    setError('')
    setBranchError('')
    const identity = await call<Me>('/api/me')
    if (identity.response.status === 401) return
    if (identity.response.status === 403) {
      setMe(null)
      setError('This Otya account does not have an active OtyaPoint staff membership. Ask the company owner to invite you and assign your work areas.')
      return
    }
    if (!identity.response.ok || !identity.payload.data) {
      setError(identity.payload.error || 'OtyaPoint could not verify your staff access.')
      return
    }

    const current = identity.payload.data as Me
    setMe(current)
    const branchResult = await call<Branch[]>('/api/branches')
    if (!branchResult.response.ok || !Array.isArray(branchResult.payload.data)) {
      setError(branchResult.payload.error || 'Your assigned branches could not be loaded.')
      return
    }
    const active = branchResult.payload.data.filter(item => !item.status || item.status === 'ACTIVE')
    setBranches(active)
    const preferred = current.branchId && active.some(item => item.id === current.branchId)
      ? current.branchId
      : active.find(item => Number(item.is_primary) === 1)?.id || active[0]?.id || ''
    setBranchId(preferred)
    if (preferred) await loadBranch(preferred, current)
    else setBranchError('No active branch is available to this account. Ask the company owner to assign a branch.')
  }, [loadBranch])

  useEffect(() => {
    let cancelled = false
    void bootstrap().catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'OtyaPoint could not be opened.')
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [bootstrap])

  async function refresh() {
    setRefreshing(true)
    try { await bootstrap() } finally { setRefreshing(false) }
  }

  async function selectBranch(next: string) {
    setBranchId(next)
    if (!me) return
    setRefreshing(true)
    try { await loadBranch(next, me) } finally { setRefreshing(false) }
  }

  const selectedBranch = branches.find(item => item.id === branchId)
  const owner = me?.role === 'SOVEREIGN'
  const areas = new Set((me?.workAssignments || []).map(item => item.work_area))
  const canInventory = Boolean(owner || areas.has('RETAIL') || areas.has('INVENTORY'))
  const canSummary = Boolean(owner || areas.has('FINANCE') || areas.has('REPORTS'))
  const canAgency = Boolean(owner || areas.has('MOBILE_MONEY'))
  const lowStock = summary?.inventory?.lowStock ?? products.filter(item => item.quantity_on_hand <= item.reorder_level).length

  return (
    <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10">
      <header className="flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between" style={{ borderColor: 'var(--cosmos-divider)' }}>
        <div>
          <div className="text-[11px] font-black uppercase tracking-[.18em] otya-muted">Otya · Private company workspace</div>
          <h1 className="mt-2 text-3xl font-black tracking-[-.05em] sm:text-4xl">OtyaPoint operations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 otya-muted">Branch-scoped retail, inventory and mobile-money operations. Your access follows your active work assignments.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-xs font-bold otya-muted">
            <span>Active branch</span>
            <select value={branchId} onChange={event => void selectBranch(event.target.value)} disabled={branches.length < 2 || refreshing} className="min-h-11 min-w-[190px] rounded-xl border bg-[color:var(--cosmos-card)] px-3 text-sm font-bold" style={{ borderColor: 'var(--cosmos-divider)', color: 'var(--cosmos-text-primary)' }}>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}{Number(branch.is_primary) === 1 ? ' · Primary' : ''}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void refresh()} disabled={refreshing || loading} className="min-h-11 rounded-xl border px-4 text-sm font-black disabled:opacity-50" style={{ borderColor: 'var(--cosmos-divider)' }}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </header>

      {loading && <div className="mt-6 rounded-2xl border p-5 text-sm otya-muted" style={{ borderColor: 'var(--cosmos-divider)' }}>Loading your OtyaPoint access and branch records…</div>}
      {error && <div role="alert" className="mt-6 rounded-2xl border border-amber-500/30 p-5 text-sm leading-6" style={{ background: 'var(--cosmos-card)' }}>{error}</div>}
      {branchError && !error && <div role="alert" className="mt-5 rounded-2xl border border-amber-500/30 p-4 text-sm">{branchError}</div>}

      {me && !error && (
        <>
          <section className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-black">{me.displayName || me.email || 'Otya staff member'}</div>
              <div className="mt-1 text-xs otya-muted">Role · {me.role} {selectedBranch ? '· ' + selectedBranch.name : ''}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(owner ? ['OWNER'] : (me.workAssignments || []).map(item => item.work_area + ' · ' + item.duty_role)).map(item => (
                <span key={item} className="rounded-full border px-3 py-1.5 text-[11px] font-black" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>{item}</span>
              ))}
            </div>
          </section>

          <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric title="Active products" value={canInventory ? String(summary?.inventory?.activeProducts ?? products.length) : 'Restricted'} detail={canInventory ? 'Available in this branch' : 'Inventory assignment required'} />
            <Metric title="Low-stock items" value={canInventory ? String(lowStock) : 'Restricted'} detail={canInventory ? 'At or below branch reorder level' : 'Inventory assignment required'} />
            <Metric title="Completed retail sales" value={canSummary && summary ? String(summary.retail?.completedSales ?? 0) : '—'} detail={canSummary && summary ? money(summary.retail?.completedSalesTotal, summary.currency || 'UGX') : 'Finance or reports assignment required'} />
            <Metric title="Agency confirmed volume" value={canAgency && agency ? money(agency.transactions?.providerConfirmedAmount, agency.currency || 'UGX') : '—'} detail={canAgency && agency ? String(agency.transactions?.needsReconciliation ?? 0) + ' need reconciliation' : 'Mobile Money assignment required'} />
          </section>

          <section className="mt-7 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
            <div className="rounded-[24px] border p-5 sm:p-6" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
              <div className="flex items-end justify-between gap-3">
                <div><div className="text-[10px] font-black uppercase tracking-[.16em] otya-muted">Branch inventory</div><h2 className="mt-2 text-xl font-black">Stock overview</h2></div>
                <span className="text-xs otya-muted">{products.length} displayed</span>
              </div>
              {!canInventory ? <RestrictedText /> : products.length === 0 ? <EmptyText text="No active branch stock records are available yet." /> : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead><tr className="border-b text-[11px] uppercase tracking-wide otya-muted" style={{ borderColor: 'var(--cosmos-divider)' }}><th className="py-3 pr-3">Product</th><th className="py-3 pr-3">SKU</th><th className="py-3 pr-3 text-right">Available</th><th className="py-3 text-right">Reorder at</th></tr></thead>
                    <tbody>{products.slice(0, 15).map(product => <tr key={product.id} className="border-b last:border-0" style={{ borderColor: 'var(--cosmos-divider)' }}>
                      <td className="py-3 pr-3 font-bold">{product.name}<div className="text-[11px] font-normal otya-muted">{product.category || 'General'}</div></td>
                      <td className="py-3 pr-3 text-xs otya-muted">{product.sku || '—'}</td>
                      <td className="py-3 pr-3 text-right font-black tabular-nums">{product.quantity_on_hand}</td>
                      <td className="py-3 text-right tabular-nums otya-muted">{product.reorder_level}</td>
                    </tr>)}</tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border p-5 sm:p-6" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
              <div className="text-[10px] font-black uppercase tracking-[.16em] otya-muted">Mobile money agency</div>
              <h2 className="mt-2 text-xl font-black">Branch activity</h2>
              {!canAgency ? <RestrictedText /> : !agency ? <EmptyText text="No agency summary has been returned for this branch." /> : (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <MiniMetric label="Transactions" value={String(agency.transactions?.count ?? 0)} />
                    <MiniMetric label="Pending / unknown" value={String(agency.transactions?.needsReconciliation ?? 0)} />
                    <MiniMetric label="Confirmed volume" value={money(agency.transactions?.providerConfirmedAmount, agency.currency || 'UGX')} />
                    <MiniMetric label="Commission" value={money(agency.transactions?.providerConfirmedCommission, agency.currency || 'UGX')} />
                  </div>
                  <p className="mt-4 text-[11px] leading-5 otya-muted">Local transaction records only. No provider request or money movement is initiated from this overview.</p>
                  {(agency.recent || []).slice(0, 4).map(item => <div key={item.id} className="flex items-center justify-between gap-3 border-t py-3 text-xs" style={{ borderColor: 'var(--cosmos-divider)' }}>
                    <div><div className="font-bold">{item.transaction_type.replaceAll('_', ' ')}</div><div className="mt-1 otya-muted">{item.reference || item.id} · {formatDate(item.created_at)}</div></div>
                    <div className="text-right"><div className="font-black">{money(item.amount, item.currency || 'UGX')}</div><div className="otya-muted">{item.provider_status}</div></div>
                  </div>)}
                </>
              )}
            </div>
          </section>

          <footer className="mt-6 flex flex-wrap justify-between gap-2 border-t pt-4 text-xs otya-muted" style={{ borderColor: 'var(--cosmos-divider)' }}>
            <span>Financial records are audited. Provider writes remain disabled until approvals and reconciliation are complete.</span>
            <span>{lastUpdated ? 'Last updated ' + formatDate(lastUpdated) : 'Waiting for branch data'}</span>
          </footer>
        </>
      )}
    </main>
  )
}

function Metric({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <div className="rounded-[20px] border p-4 sm:p-5" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}>
    <div className="text-[10px] font-black uppercase tracking-[.14em] otya-muted">{title}</div>
    <div className="mt-3 text-2xl font-black tracking-[-.035em] tabular-nums">{value}</div>
    <div className="mt-1 text-xs otya-muted">{detail}</div>
  </div>
}
function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl p-3" style={{ background: 'var(--cosmos-scaffold)' }}>
    <div className="text-[10px] font-black uppercase tracking-wide otya-muted">{label}</div>
    <div className="mt-1 break-all text-base font-black tabular-nums">{value}</div>
  </div>
}
function RestrictedText() {
  return <p className="mt-5 rounded-xl p-3 text-xs leading-5 otya-muted" style={{ background: 'var(--cosmos-scaffold)' }}>This area is not included in your active work assignments. Ask the company owner to review your access.</p>
}
function EmptyText({ text }: { text: string }) {
  return <p className="mt-5 rounded-xl p-3 text-xs leading-5 otya-muted" style={{ background: 'var(--cosmos-scaffold)' }}>{text}</p>
}
