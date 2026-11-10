# OTYA System Asset Kit

This document is the single source of truth for OTYA website, app-store, social, APK-release and future marketing assets.

## Non-negotiable OTYA identity

- The canonical symbol is the approved **twisted O** supplied in the OTYA brand pack. Do not redraw it as a plain ring and do not substitute a play triangle.
- The official color flow is **cyan/electric blue → violet/magenta → orange/yellow** on deep navy/black surfaces.
- When the symbol and product name appear on the same line, render **symbol + TYA**, never **symbol + OTYA**. The symbol itself is the O.
- Keep the symbol geometry unchanged across Android launcher/adaptive/themed icons, Flutter UI, website/favicon/PWA, Admin, Developer surfaces, emails, store assets and marketing art.
- Single-color/monochrome variants may change color only; the geometry must remain the same.
- User-facing screenshots and mockups must use the real current OTYA UI. Do not invent a second app interface inside a phone mockup and present it as the shipped product.

## Already wired assets

- `public/otya-icon.svg` — canonical OTYA twisted-O symbol.
- `public/android-chrome-192x192.png` — PWA icon.
- `public/android-chrome-512x512.png` — PWA/app icon.
- `public/apple-touch-icon.png` — Apple/iOS browser icon.
- `public/favicon.ico`, `public/favicon-16x16.png`, `public/favicon-32x32.png` — browser tab icons.
- `public/og-image.jpg` and `public/og-image.svg` — social preview.
- `public/future-graphic.png` — existing future/hero graphic.
- `public/manifest.json` and `public/site.webmanifest` — PWA manifest files.

## New reusable brand assets

- `public/brand/otya-feature-graphic.svg` — Google Play / website feature banner template.
- `public/brand/otya-social-card.svg` — social sharing / announcement card template.
- `public/brand/otya-release-poster.svg` — release/update poster template.
- `public/brand/otya-screenshot-frame.svg` — screenshot frame for website and store listings.
- `public/brand/README.md` — usage notes.

## Asset groups the system should maintain

### Website

- Favicon set.
- PWA manifest icons.
- OpenGraph image.
- Twitter/social card image.
- Hero/future graphic.
- App download badges.
- Release update poster.

### Otya Media app store

- App icon 512x512.
- Feature graphic 1024x500.
- Phone screenshots.
- Tablet screenshots if supported.
- Short description.
- Long description.
- Privacy policy page.
- Support page.
- Changelog page.

### APK/self-update system

- APK artifact names.
- Version JSON.
- Release notes.
- SHA-256 checksum text.
- Update dialog image/banner.
- Download page hero graphic.

### Auth/email system

- Welcome email header image.
- OTP/security email header image.
- Password reset email header image.
- Transactional email footer brand line.
- Verified Resend sender domain: `petersmartlink.com`.

### Future graphics

- Major release poster.
- New feature poster.
- Security/privacy poster.
- Update available poster.
- Store banner.
- Social launch card.

## Real screenshots policy

Do not fake final app screenshots. Use `public/brand/otya-screenshot-frame.svg` as a template only. Final screenshots should be captured from the real signed APK after the source, crash and physical-device gates pass.

## Production verification checklist

- App uses one canonical OTYA twisted-O geometry on every surface.
- No old play-logo or generic-ring asset remains reachable in app or website UI.
- GitHub `main` is green before release.
- Cloudflare Worker deploy is green.
- Auth Worker deploy is green.
- D1/KV bindings are connected.
- Resend domain is verified.
- Website pages load.
- API endpoints respond.
- OTP/register/login/reset flows work.
- APK artifact downloads.
- App screenshots are captured from a real build.
