// api/linkedin.js — Vercel serverless function for LinkedIn
// NOTE: LinkedIn's Marketing API requires OAuth 2.0.
// This function uses a long-lived access token stored in env vars.
// To get your token: https://www.linkedin.com/developers/apps → OAuth 2.0 tools
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const { LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORG_ID } = process.env
  if (!LINKEDIN_ACCESS_TOKEN) return res.status(500).json({ error: 'LINKEDIN_ACCESS_TOKEN not configured' })

  const headers = {
    Authorization: `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
    'LinkedIn-Version': '202401',
    'X-Restli-Protocol-Version': '2.0.0'
  }

  try {
    const { action } = req.query

    // GET /api/linkedin?action=profile — basic profile info
    if (action === 'profile' || !action) {
      const r = await fetch('https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture)', { headers })
      const profile = await r.json()

      // Connection count (requires r_network_size permission)
      const connR = await fetch('https://api.linkedin.com/v2/connections?q=viewer&count=0', { headers })
      const connData = await connR.json()

      return res.status(200).json({
        name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
        id: profile.id,
        connections: connData.paging?.total || null,
        note: 'Profile views & impressions require LinkedIn Page Analytics API (organisation account)'
      })
    }

    // GET /api/linkedin?action=org-stats — page analytics (requires organisation token)
    if (action === 'org-stats' && LINKEDIN_ORG_ID) {
      const since = Date.now() - 30 * 24 * 60 * 60 * 1000
      const url = `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${LINKEDIN_ORG_ID}&timeIntervals.timeGranularityType=MONTH&timeIntervals.timeRange.start=${since}&timeIntervals.timeRange.end=${Date.now()}`
      const r = await fetch(url, { headers })
      const data = await r.json()
      const stats = data.elements?.[0]?.totalShareStatistics || {}
      return res.status(200).json({
        impressions: stats.impressionCount || 0,
        uniqueImpressions: stats.uniqueImpressionsCount || 0,
        clicks: stats.clickCount || 0,
        shares: stats.shareCount || 0,
        reactions: stats.likeCount || 0,
        comments: stats.commentCount || 0
      })
    }

    // GET /api/linkedin?action=recent-posts — latest posts from the page
    if (action === 'recent-posts' && LINKEDIN_ORG_ID) {
      const url = `https://api.linkedin.com/v2/shares?q=owners&owners=urn:li:organization:${LINKEDIN_ORG_ID}&count=5`
      const r = await fetch(url, { headers })
      const data = await r.json()
      const posts = (data.elements || []).map(p => ({
        id: p.id,
        text: p.text?.text?.slice(0, 120) + '...' || '(no text)',
        created: new Date(p.created?.time).toLocaleDateString('en-GB'),
        likes: p.socialDetail?.totalSocialActivityCounts?.numLikes || 0,
        comments: p.socialDetail?.totalSocialActivityCounts?.numComments || 0
      }))
      return res.status(200).json({ posts })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('LinkedIn error:', err)
    return res.status(500).json({ error: err.message })
  }
}
