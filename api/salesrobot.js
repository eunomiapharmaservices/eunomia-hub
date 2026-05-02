// api/salesrobot.js — Vercel serverless function for Sales Robot
// Sales Robot exposes a REST API at app.salesrobot.co
// Docs: https://app.salesrobot.co/api-docs (requires your account API key)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { SALES_ROBOT_API_KEY } = process.env
  if (!SALES_ROBOT_API_KEY) return res.status(500).json({ error: 'SALES_ROBOT_API_KEY not configured' })

  const base = 'https://app.salesrobot.co/api/v1'
  const headers = { 'x-api-key': SALES_ROBOT_API_KEY, 'Content-Type': 'application/json' }

  try {
    const { action } = req.query

    // GET /api/salesrobot?action=campaigns — all active campaigns/sequences
    if (action === 'campaigns' || !action) {
      const r = await fetch(`${base}/campaigns`, { headers })
      const data = await r.json()
      const campaigns = (data.campaigns || data.data || []).map(c => ({
        id: c.id,
        name: c.name || c.title,
        status: c.status,
        sent: c.total_sent || c.messages_sent || 0,
        replies: c.total_replies || c.replies_count || 0,
        rate: c.total_sent
          ? ((c.total_replies / c.total_sent) * 100).toFixed(1)
          : '0.0',
        meetings: c.meetings_booked || 0
      }))

      const totalSent = campaigns.reduce((s, c) => s + c.sent, 0)
      const totalReplies = campaigns.reduce((s, c) => s + c.replies, 0)

      return res.status(200).json({
        campaigns,
        summary: {
          activeSequences: campaigns.filter(c => c.status === 'active').length,
          messagesSent: totalSent,
          replies: totalReplies,
          replyRate: totalSent ? ((totalReplies / totalSent) * 100).toFixed(1) : '0.0',
          meetings: campaigns.reduce((s, c) => s + (c.meetings || 0), 0)
        }
      })
    }

    // GET /api/salesrobot?action=leads&campaignId=xxx — leads in a campaign
    if (action === 'leads') {
      const { campaignId } = req.query
      if (!campaignId) return res.status(400).json({ error: 'campaignId required' })
      const r = await fetch(`${base}/campaigns/${campaignId}/leads`, { headers })
      const data = await r.json()
      return res.status(200).json({ leads: data.leads || data.data || [] })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('Sales Robot error:', err)
    return res.status(500).json({ error: err.message })
  }
}
