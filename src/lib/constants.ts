export const OTYA = {
  name: 'Otya',
  player: 'Omy Play',
  ai: 'O',
  auth: 'OID',
  console: 'O private workspace',
  backend: 'OEnd',
  website: 'https://otya.site',
  supportEmail: 'support@otya.site',
  noReplyEmail: 'noreply@otya.site',
  telegramChannel: 'https://t.me/otyaplayer',
  telegramSupport: 'https://t.me/OtyaPlayerBot',
  description: 'Otya connects Omy Play, Opoint, Otya Account and shared platform services under one trusted identity. Omy Play remains local-first and works offline for core playback.',
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
