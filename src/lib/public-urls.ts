function safeHttpsOrigin(value: string | undefined, fallback: string): string {
  if (!value) return fallback
  try {
    const parsed = new URL(value)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return fallback
    return parsed.origin
  } catch {
    return fallback
  }
}

function safeEmail(value: string | undefined, fallback: string): string {
  const candidate = value?.trim() ?? ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : fallback
}

// Public addresses are replaceable configuration. Product and account identity
// must never be derived from these URLs.
export const PUBLIC_URLS = Object.freeze({
  primary: safeHttpsOrigin(
    process.env.NEXT_PUBLIC_OTYA_PUBLIC_URL || process.env.OTYA_PUBLIC_URL || process.env.WEBSITE_URL,
    'https://otya.site',
  ),
  api: safeHttpsOrigin(process.env.NEXT_PUBLIC_OTYA_API_URL || process.env.OTYA_API_URL, 'https://api.otya.site'),
  assets: safeHttpsOrigin(process.env.NEXT_PUBLIC_OTYA_ASSETS_URL || process.env.OTYA_ASSETS_URL, 'https://assets.otya.site'),
  docs: safeHttpsOrigin(process.env.NEXT_PUBLIC_OTYA_DOCS_URL, 'https://docs.otya.site'),
  status: safeHttpsOrigin(process.env.NEXT_PUBLIC_OTYA_STATUS_URL, 'https://status.otya.site'),
  space: safeHttpsOrigin(process.env.NEXT_PUBLIC_OTYA_SPACE_URL, 'https://space.otya.site'),
  supportEmail: safeEmail(process.env.OTYA_SUPPORT_EMAIL, 'support@otya.site'),
  noReplyEmail: safeEmail(process.env.OTYA_NO_REPLY_EMAIL, 'noreply@otya.site'),
})
