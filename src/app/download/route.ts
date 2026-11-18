import { NextRequest, NextResponse } from 'next/server'

// GET /download — redirects to the download page
// Used as a short link in share messages and the app
export async function GET(_req: NextRequest) {
  return NextResponse.redirect(
    'https://otya.site/download/otya-player',
    { status: 302 }
  )
}
