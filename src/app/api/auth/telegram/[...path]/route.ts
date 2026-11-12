import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function retired(): NextResponse {
  return NextResponse.json({
    error: 'telegram_sign_in_disabled',
    message: 'Telegram is not an Otya sign-in method. Use your Otya account; Telegram may be used only as a separately linked verification channel.',
  }, {
    status: 410,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export const GET = retired
export const POST = retired
export const OPTIONS = retired
