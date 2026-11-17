'use client'

import { ReactNode, useEffect, useState } from 'react'
import { OtyaSpaceChrome } from '@/components/OtyaSpaceChrome'

type SpaceUser = {
  email?: string | null
  name?: string | null
  avatar_url?: string | null
  otya_id?: string | null
}

type SessionState = {
  authenticated?: boolean
  user?: SpaceUser
}

const PUBLIC_OTYA_ID = /^2IS\d{8}$/i

function sectionForLegacyPath(pathname: string, hash: string) {
  if (pathname === '/' || pathname === '/space' || pathname === '/space/') return 'overview'
  if (pathname === '/account' || pathname === '/account/') return 'account'
  if (pathname === '/account/sign-in-methods' || pathname === '/account/sign-in-methods/') return 'providers'
  if (pathname === '/account/security' || pathname === '/account/security/' || hash === '#security') return 'security'
  if (pathname === '/account/devices' || pathname === '/account/devices/' || hash === '#sessions') return 'devices'
  if (pathname === '/account/storage' || pathname === '/account/storage/' || hash === '#storage') return 'storage'
  if (pathname === '/account/activity' || pathname === '/account/activity/' || hash === '#activity') return 'activity'
  if (pathname === '/account/notifications' || pathname === '/account/notifications/' || hash === '#notifications') return 'notifications'
  if (pathname === '/account/settings' || pathname === '/account/settings/' || hash === '#settings') return 'settings'
  return null
}

function canonicalizeSpaceLocation(publicId: string) {
  if (!PUBLIC_OTYA_ID.test(publicId)) return false

  const canonicalId = publicId.toUpperCase()
  const { pathname, hash, search } = window.location
  const parts = pathname.split('/').filter(Boolean)

  if (parts[0] === 'u') {
    const routeId = parts[1]?.toUpperCase()
    const section = parts.slice(2).join('/') || 'overview'
    if (routeId !== canonicalId) {
      window.location.replace(`/u/${canonicalId}/${section}${search}${hash}`)
      return true
    }
    return false
  }

  const section = sectionForLegacyPath(pathname, hash)
  if (!section) return false
  window.location.replace(`/u/${canonicalId}/${section}${search}`)
  return true
}

export function OtyaSpaceGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SpaceUser | null>(null)
  const [businessAccess, setBusinessAccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    void fetch('/api/account-session/session', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }).then(async response => {
      const session = await response.json().catch(() => ({})) as SessionState
      if (cancelled) return
      if (!response.ok || session.authenticated !== true) {
        window.location.replace('/sign-in')
        return
      }

      const verifiedUser = session.user ?? {}
      const publicId = verifiedUser.otya_id?.trim()
      if (publicId && canonicalizeSpaceLocation(publicId)) return
      const pointAccess = await fetch('/api/point/api/me', {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      }).catch(() => null)
      if (cancelled) return
      setBusinessAccess(pointAccess?.ok === true)
      setUser(verifiedUser)
    }).catch(() => {
      if (!cancelled) window.location.replace('/sign-in')
    })

    return () => { cancelled = true }
  }, [])

  if (!user) {
    return <div className="min-h-screen grid place-items-center" style={{ background: 'var(--cosmos-scaffold)', color: 'var(--cosmos-text-primary)' }}>
      <div className="text-center">
        <div className="w-10 h-10 rounded-2xl mx-auto mb-4 animate-pulse" style={{ background: 'var(--cosmos-primary)' }} />
        <p className="text-sm otya-muted">Opening Otya Space…</p>
      </div>
    </div>
  }

  return <OtyaSpaceChrome initialUser={user} businessAccess={businessAccess}>{children}</OtyaSpaceChrome>
}
