import { redirect } from 'next/navigation'

// Opoint is a private company application, not a public shop brand.
// The public physical storefront is Otya.
export default function OpointLegacyRoute() {
  redirect('/shop')
}
