'use client'

import Link from 'next/link'

export default function StoragePage() {
  return <main className="px-4 sm:px-7 lg:px-10 py-7 sm:py-9 max-w-[940px]">
    <header className="mb-7"><div className="text-[11px] font-black uppercase tracking-[.16em] otya-muted">Otya Space</div><h1 className="mt-2 text-3xl sm:text-4xl font-black tracking-[-.045em]">Data & recovery</h1><p className="mt-2 text-sm sm:text-base otya-muted">What lives on your device, what can be recovered, and what Otya does not upload.</p></header>
    <section className="grid md:grid-cols-2 gap-4">
      <Card title="Device-first media"><Row label="Music & video files" value="Stay on device"/><Row label="Private media" value="Stay in app-private storage"/><Row label="Playback history" value="Device-first in v1"/><p className="mt-4 text-xs leading-5 otya-muted">Otya does not upload your media library just because you browse or play it.</p></Card>
      <Card title="Playlist recovery"><Row label="Playlist names" value="Supported"/><Row label="Saved media references" value="Supported"/><Row label="Raw media files" value="Not uploaded"/><p className="mt-4 text-xs leading-5 otya-muted">Google Drive recovery is explicit and user-initiated from the Android app. It uses the app-specific Drive area rather than a second Otya identity system.</p></Card>
      <Card title="Account data"><p className="text-sm leading-6 otya-muted">Your Otya account can store identity, security, linked-provider, session and account-preference information needed for connected services.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/account/" className="otya-quiet-button inline-flex min-h-10 items-center rounded-xl px-3.5 text-xs font-black">Account</Link><a href="https://otya.site/privacy" className="otya-quiet-button inline-flex min-h-10 items-center rounded-xl px-3.5 text-xs font-black">Privacy policy</a></div></Card>
      <Card title="Storage controls"><p className="text-sm leading-6 otya-muted">Phone storage analysis, cache cleanup and media-folder controls remain in the Android app because they act on local device files.</p><p className="mt-3 text-xs leading-5 otya-muted">Space will only show cloud-backed data when the backend truly supports it; no placeholder cloud counts are invented.</p></Card>
    </section>
  </main>
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-[24px] border p-5 sm:p-6" style={{ borderColor: 'var(--cosmos-divider)', background: 'var(--cosmos-card)' }}><h2 className="text-xl font-black mb-4">{title}</h2>{children}</section> }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between gap-4 border-t first:border-t-0 py-2.5 text-sm" style={{ borderColor: 'var(--cosmos-divider)' }}><span className="otya-muted">{label}</span><span className="font-black text-right">{value}</span></div> }
