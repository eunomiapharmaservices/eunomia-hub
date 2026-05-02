// api/mailchimp.js — Vercel serverless function for Mailchimp
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { MAILCHIMP_API_KEY, MAILCHIMP_SERVER_PREFIX, MAILCHIMP_LIST_ID } = process.env
  if (!MAILCHIMP_API_KEY) return res.status(500).json({ error: 'MAILCHIMP_API_KEY not configured' })

  const base = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0`
  const auth = Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64')
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }

  try {
    const { action } = req.query

    if (action === 'stats' || !action) {
      const [listRes, campaignsRes] = await Promise.all([
        fetch(`${base}/lists/${MAILCHIMP_LIST_ID}`, { headers }),
        fetch(`${base}/campaigns?count=10&status=sent&sort_field=send_time&sort_dir=DESC`, { headers })
      ])
      const list = await listRes.json()
      const campaigns = await campaignsRes.json()
      if (list.status === 404) return res.status(404).json({ error: 'List not found. Check MAILCHIMP_LIST_ID.' })

      const recentCampaigns = (campaigns.campaigns || []).slice(0, 5).map(c => ({
        id: c.id,
        name: c.settings?.subject_line || c.settings?.title,
        date: c.send_time ? new Date(c.send_time).toLocaleDateString('en-GB') : '-',
        sent: c.emails_sent,
        opens: c.report_summary?.open_rate ? (c.report_summary.open_rate * 100).toFixed(1) + '%' : '-',
        clicks: c.report_summary?.click_rate ? (c.report_summary.click_rate * 100).toFixed(1) + '%' : '-',
        status: 'Sent'
      }))

      const withRates = recentCampaigns.filter(c => c.opens !== '-')
      const avgOpen = withRates.length
        ? (withRates.reduce((s, c) => s + parseFloat(c.opens), 0) / withRates.length).toFixed(1)
        : null

      return res.status(200).json({
        subscribers: list.stats?.member_count || 0,
        openRate: avgOpen,
        lastSent: campaigns.campaigns?.[0]?.send_time || null,
        lastSubject: campaigns.campaigns?.[0]?.settings?.subject_line || null,
        campaigns: recentCampaigns
      })
    }

    if (action === 'create-campaign' && req.method === 'POST') {
      const { subject, body } = req.body
      if (!subject || !body) return res.status(400).json({ error: 'subject and body required' })

      const createRes = await fetch(`${base}/campaigns`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'regular',
          recipients: { list_id: MAILCHIMP_LIST_ID },
          settings: {
            subject_line: subject,
            from_name: 'Eunomia',
            reply_to: 'hello@eunomia.com',
            title: subject
          }
        })
      })
      const campaign = await createRes.json()
      if (!campaign.id) return res.status(500).json({ error: 'Failed to create campaign', detail: campaign })

      await fetch(`${base}/campaigns/${campaign.id}/content`, {
        method: 'PUT', headers,
        body: JSON.stringify({ plain_text: body })
      })

      return res.status(200).json({
        success: true,
        campaignId: campaign.id,
        editUrl: `https://us1.admin.mailchimp.com/campaigns/edit?id=${campaign.web_id}`
      })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('Mailchimp error:', err)
    return res.status(500).json({ error: err.message })
  }
}
