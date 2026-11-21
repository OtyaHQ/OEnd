export const OTYA = {
  name: 'Otya',
  player: 'Omy Play',
  ai: 'O',
  auth: 'OID',
  console: 'O',
  backend: 'OEnd',
  website: 'https://otya.site',
  supportEmail: 'support@otya.site',
  noReplyEmail: 'noreply@otya.site',
  telegramChannel: 'https://t.me/otyaplayer',
  telegramSupport: 'https://t.me/OtyaPlayerBot',
  description: 'Otya connects Omy Play, Opoint, OID and the wider Otya ecosystem, nearby Send, Private media, practical tools and one secure account. Core playback and nearby sharing remain local-first.',
} as const;

export const SITE_CONFIG = {
  name: OTYA.name,
  ownerName: OTYA.name,
  url: OTYA.website,
  description: OTYA.description,
  email: OTYA.supportEmail,
  telegram: OTYA.telegramSupport,
  telegramChannel: OTYA.telegramChannel,
  address: 'Uganda',
  social: {},
} as const;
