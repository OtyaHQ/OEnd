export default {
  async fetch(request) {
    const url = new URL(request.url)
    if (url.pathname === '/internal/telegram/otp' && request.method === 'POST') {
      const suppliedSecret = request.headers.get('X-OTYA-Internal-Secret') || ''
      if (!suppliedSecret || request.headers.get('X-OTYA-Service') !== 'otya-auth') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
      const body = await request.json().catch(() => ({}))
      if (!/^[1-9][0-9]{3,15}$/.test(String(body.chat_id ?? ''))
        || !/^[A-Z][0-9]{4}$/.test(String(body.code ?? ''))
        || !['email-change', 'password-reset', 'owner-verification'].includes(String(body.purpose ?? ''))) {
        return Response.json({ error: 'Invalid OTP delivery request' }, { status: 400 })
      }
      return Response.json({ ok: true }, { status: 202 })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  },
}
