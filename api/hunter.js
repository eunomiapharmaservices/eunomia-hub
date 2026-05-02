// api/hunter.js — Vercel serverless function for Hunter.io
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { HUNTER_API_KEY } = process.env
  if (!HUNTER_API_KEY) return res.status(500).json({ error: 'HUNTER_API_KEY not configured' })

  const base = 'https://api.hunter.io/v2'
  const { action, domain, email } = req.query

  try {
    // GET /api/hunter?action=account — account credits and usage
    if (action === 'account' || !action) {
      const r = await fetch(`${base}/account?api_key=${HUNTER_API_KEY}`)
      const data = await r.json()
      const acc = data.data
      return res.status(200).json({
        creditsUsed: acc.requests.searches.used,
        creditsTotal: acc.requests.searches.available,
        verificationUsed: acc.requests.verifications.used,
        verificationTotal: acc.requests.verifications.available,
        plan: acc.plan_name
      })
    }

    // GET /api/hunter?action=domain-search&domain=pfizer.com — find emails at a domain
    if (action === 'domain-search' && domain) {
      const r = await fetch(`${base}/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}&limit=10`)
      const data = await r.json()
      const emails = (data.data?.emails || []).map(e => ({
        name: [e.first_name, e.last_name].filter(Boolean).join(' '),
        email: e.value,
        confidence: e.confidence,
        role: e.position || null,
        department: e.department || null
      }))
      return res.status(200).json({ domain, emails, total: data.data?.meta?.total || 0 })
    }

    // GET /api/hunter?action=verify&email=name@company.com — verify a single email
    if (action === 'verify' && email) {
      const r = await fetch(`${base}/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`)
      const data = await r.json()
      return res.status(200).json({
        email,
        status: data.data?.status,        // valid / risky / invalid / unknown
        score: data.data?.score,
        mxRecords: data.data?.mx_records,
        result: data.data?.result
      })
    }

    // POST /api/hunter?action=bulk-find — find emails for a list of {firstName, lastName, domain}
    if (action === 'bulk-find' && req.method === 'POST') {
      const { leads } = req.body // array of { firstName, lastName, domain }
      if (!leads || !Array.isArray(leads)) return res.status(400).json({ error: 'leads array required' })

      const results = await Promise.all(
        leads.slice(0, 20).map(async ({ firstName, lastName, domain }) => {
          const url = `${base}/email-finder?domain=${domain}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${HUNTER_API_KEY}`
          const r = await fetch(url)
          const d = await r.json()
          return {
            name: `${firstName} ${lastName}`,
            domain,
            email: d.data?.email || null,
            confidence: d.data?.score || 0,
            status: d.data?.email ? 'found' : 'not_found'
          }
        })
      )

      return res.status(200).json({ results, found: results.filter(r => r.email).length, total: results.length })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('Hunter error:', err)
    return res.status(500).json({ error: err.message })
  }
}
