const url = 'https://otya.site/api/admin/session'

for (let attempt = 1; attempt <= 6; attempt++) {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await response.json().catch(() => ({}))
    if (response.ok && body?.configured === true) {
      console.log('Live Otya Admin MFA configuration verified.')
      process.exit(0)
    }
    console.error(`Admin MFA verification attempt ${attempt} returned configured=${body?.configured === true}.`)
  } catch (error) {
    console.error(`Admin MFA verification attempt ${attempt} failed: ${error instanceof Error ? error.message : 'network error'}`)
  }

  if (attempt < 6) await new Promise(resolve => setTimeout(resolve, attempt * 3000))
}

console.error('Live Otya Admin MFA is not configured after deployment.')
process.exit(1)
