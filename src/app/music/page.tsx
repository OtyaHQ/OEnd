import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteNav } from '@/components/SiteNav'
import { SiteFooter } from '@/components/SiteFooter'
import { OtyaBrandMark } from '@/components/OtyaBrandMark'

export const metadata: Metadata = {
  title: 'Otya Media Music — Local Android Music Player',
  description: 'Play and organize music already on your Android device with Otya Media. Local songs, albums, artists, folders and playlists work without a streaming provider.',
  alternates: { canonical: 'https://petersmartlink.com/music' },
}

const features = [
  ['Songs', 'Play audio already available on your Android device.'],
  ['Albums & artists', 'Browse local metadata without uploading your library.'],
  ['Folders', 'Keep the device folders you already understand.'],
  ['Playlists', 'Create and manage local playlists without a provider account.'],
  ['Background playback', 'Keep listening with Android media controls and your normal device audio session.'],
  ['Offline search', 'Search your local library without contacting a music catalog while you type.'],
] as const

export default function MusicPage() {
  return <div className="min-h-screen flex flex-col" style={{ background: 'var(--cosmos-scaffold)', color: 'var(--cosmos-text-primary)' }}>
    <SiteNav />
    <main className="flex-1">
      <section className="otya-shell py-16 sm:py-24">
        <div className="max-w-[780px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/[.07] dark:border-white/[.10] px-3 py-1.5 text-xs font-black otya-muted">
            <OtyaBrandMark size={22} />
            Otya Media · Local-first music
          </div>
          <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-[-.055em] leading-[.98]">Your music stays yours.</h1>
          <p className="mt-6 max-w-[680px] text-base sm:text-lg leading-8 otya-muted">
            Otya Media is built for songs already on your Android device. It does not depend on an online music catalog, a streaming-provider account or a provider API to keep your library useful.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/download/otya-player" className="cosmos-button inline-flex min-h-12 items-center rounded-full px-6 font-black">Download Otya Media</Link>
            <Link href="/help" className="otya-quiet-button inline-flex min-h-12 items-center rounded-full px-6 font-black">Open Help</Link>
          </div>
        </div>
      </section>

      <section className="otya-shell pb-16 sm:pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(([title, detail]) => <article key={title} className="rounded-[24px] border border-black/[.07] dark:border-white/[.09] bg-[color:var(--cosmos-surface)] p-5 sm:p-6">
            <h2 className="text-lg font-black">{title}</h2>
            <p className="mt-2 text-sm leading-6 otya-muted">{detail}</p>
          </article>)}
        </div>
      </section>

      <section className="border-y border-black/[.06] dark:border-white/[.08] bg-black/[.018] dark:bg-white/[.025]">
        <div className="otya-shell py-12 sm:py-16 grid md:grid-cols-2 gap-8 items-start">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[.16em] otya-muted">Current product scope</div>
            <h2 className="mt-3 text-2xl sm:text-3xl font-black tracking-[-.035em]">No built-in online music catalog</h2>
          </div>
          <div className="text-sm sm:text-base leading-7 otya-muted space-y-3">
            <p>Otya Media does not currently offer a built-in online song catalog. The previous provider integration was removed because it did not provide the music coverage the product needs.</p>
            <p>Local playback, playlists, background audio, search and media organization remain part of Otya Media and continue to work without that provider.</p>
          </div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
}
