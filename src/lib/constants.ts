export const OTYA = {
  name: 'Otya',
  player: 'Omy Play',
  ai: 'Otya Next',
  auth: 'Otya ID',
  console: 'Otya Control',
  backend: 'Otya End',
  website: 'https://otya.site',
  supportEmail: 'support@petersmartlink.com',
  noReplyEmail: 'noreply@otya.site',
  telegramChannel: 'https://t.me/otyaplayer',
  telegramSupport: 'https://t.me/OtyaPlayerBot',
  description: 'Otya is a connected family of digital products and services, designed to work together while keeping product data, permissions and user privacy carefully separated.',
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
