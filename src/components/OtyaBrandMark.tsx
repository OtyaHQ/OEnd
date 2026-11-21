'use client'

type Props = {
  size?: number
  thinking?: boolean
  ai?: boolean
  className?: string
  label?: string
  product?: 'opoint' | 'omy-play' | 'otya-os' | 'ohub' | 'oid'
}

/** Canonical Otya identity shared with the Android app. */
export function OtyaBrandMark({ size = 36, thinking = false, ai = false, className = '', label, product }: Props) {
  const productAssets = {
    opoint: 'https://assets.otya.site/brand/otya/v4/icons/opoint.webp',
    'omy-play': 'https://assets.otya.site/brand/otya/v4/icons/omy-play.webp',
    'otya-os': 'https://assets.otya.site/brand/otya/v4/icons/otya-os.webp',
    ohub: 'https://assets.otya.site/brand/otya/v4/icons/ohub.webp',
    oid: 'https://assets.otya.site/brand/otya/v4/icons/oid.webp',
  } as const
  const accessibleLabel = label ?? (product ? product : ai ? 'O owner workspace' : 'Otya')
  return <img
    src={product ? productAssets[product] : '/otya-app-icon.webp'}
    width={size}
    height={size}
    alt={accessibleLabel || 'Otya'}
    aria-label={accessibleLabel || undefined}
    className={`block shrink-0 object-contain ${thinking ? 'otya-brand-thinking' : ''} ${className}`}
    style={{ width: size, height: size, background: 'transparent' }}
  />
}
