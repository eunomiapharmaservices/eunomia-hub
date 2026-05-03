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

    // ── GET stats ─────────────────────────────────────────────────────────────
    if (action === 'stats' || !action) {
      const [listRes, campaignsRes] = await Promise.all([
        fetch(`${base}/lists/${MAILCHIMP_LIST_ID}`, { headers }),
        fetch(`${base}/campaigns?count=10&sort_field=send_time&sort_dir=DESC`, { headers })
      ])
      const list = await listRes.json()
      const campaigns = await campaignsRes.json()
      if (list.status === 404) return res.status(404).json({ error: 'List not found. Check MAILCHIMP_LIST_ID.' })

      const recentCampaigns = (campaigns.campaigns || []).slice(0, 8).map(c => ({
        id: c.id,
        webId: c.web_id,
        name: c.settings?.subject_line || c.settings?.title,
        date: c.send_time ? new Date(c.send_time).toLocaleDateString('en-GB') : '-',
        sent: c.emails_sent,
        opens: c.report_summary?.open_rate ? (c.report_summary.open_rate * 100).toFixed(1) + '%' : '-',
        clicks: c.report_summary?.click_rate ? (c.report_summary.click_rate * 100).toFixed(1) + '%' : '-',
        status: c.status  // sent, draft, save, paused, schedule, sending
      }))

      const sentWithRates = recentCampaigns.filter(c => c.opens !== '-' && c.status === 'sent')
      const avgOpen = sentWithRates.length
        ? (sentWithRates.reduce((s, c) => s + parseFloat(c.opens), 0) / sentWithRates.length).toFixed(1)
        : null

      return res.status(200).json({
        subscribers: list.stats?.member_count || 0,
        openRate: avgOpen,
        lastSent: campaigns.campaigns?.find(c => c.status === 'sent')?.send_time || null,
        lastSubject: campaigns.campaigns?.find(c => c.status === 'sent')?.settings?.subject_line || null,
        campaigns: recentCampaigns
      })
    }

    // ── POST create-campaign ──────────────────────────────────────────────────
    if (action === 'create-campaign' && req.method === 'POST') {
      const { subject, body } = req.body
      if (!subject || !body) return res.status(400).json({ error: 'subject and body required' })

      const createRes = await fetch(`${base}/campaigns`, {
        method: 'POST', headers,
        body: JSON.stringify({
          type: 'regular',
          recipients: { list_id: MAILCHIMP_LIST_ID },
          settings: { subject_line: subject, from_name: 'Eunomia', reply_to: 'hello@eunomia.com', title: subject }
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

    // ── POST send-campaign — send a draft campaign immediately ────────────────
    if (action === 'send-campaign' && req.method === 'POST') {
      const { campaignId } = req.body
      if (!campaignId) return res.status(400).json({ error: 'campaignId required' })

      const sendRes = await fetch(`${base}/campaigns/${campaignId}/actions/send`, {
        method: 'POST', headers
      })

      // Mailchimp returns 204 No Content on success
      if (sendRes.status === 204) {
        return res.status(200).json({ success: true, message: 'Campaign sent successfully' })
      }

      const err = await sendRes.json().catch(() => ({}))
      return res.status(400).json({ error: err.detail || err.title || 'Failed to send campaign' })
    }

    // ── POST add-members — add Hunter.io results to Mailchimp list ────────────
    if (action === 'add-members' && req.method === 'POST') {
      const { members, tag } = req.body
      if (!members || !Array.isArray(members)) return res.status(400).json({ error: 'members array required' })

      // Mailchimp batch subscribe
      const batchRes = await fetch(`${base}/lists/${MAILCHIMP_LIST_ID}`, {
        method: 'POST', headers,
        body: JSON.stringify({
          members: members.map(m => ({
            email_address: m.email,
            status: 'subscribed',
            merge_fields: {
              FNAME: m.name?.split(' ')[0] || '',
              LNAME: m.name?.split(' ').slice(1).join(' ') || ''
            },
            tags: [tag || 'ABM-Hunter']
          })),
          update_existing: true
        })
      })
      const result = await batchRes.json()

      return res.status(200).json({
        success: true,
        added: result.new_members?.length || 0,
        updated: result.updated_members?.length || 0,
        errors: result.errors?.length || 0,
        errorDetail: result.errors?.slice(0, 3) || []
      })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })

  } catch (err) {
    console.error('Mailchimp error:', err)
    return res.status(500).json({ error: err.message })
  }
}
