# Eunomia Marketing Hub

## Deploy to Vercel in 3 steps

### Step 1 — Upload to GitHub
1. github.com → New repository → name it `eunomia-hub` → Create
2. Drag this entire folder into the GitHub page → Commit changes

### Step 2 — Deploy on Vercel
1. vercel.com → Sign up with GitHub
2. Add New Project → Import `eunomia-hub`
3. **IMPORTANT**: In "Build & Output Settings":
   - Build Command: leave BLANK (delete anything in there)
   - Output Directory: `public`
4. Click Deploy

### Step 3 — Add API keys
Vercel → your project → Settings → Environment Variables:

| Variable | Where to find it |
|---|---|
| ANTHROPIC_API_KEY | console.anthropic.com → API Keys |
| MAILCHIMP_API_KEY | Mailchimp → Account → Extras → API Keys |
| MAILCHIMP_SERVER_PREFIX | Last part of your key e.g. `us1` |
| MAILCHIMP_LIST_ID | Mailchimp → Audience → Settings |
| HUNTER_API_KEY | hunter.io → Dashboard → API |
| LINKEDIN_ACCESS_TOKEN | linkedin.com/developers → your app |
| LINKEDIN_ORG_ID | Your LinkedIn company page number |
| SALES_ROBOT_API_KEY | Sales Robot → Settings → API |

Then: Vercel → Deployments → Redeploy

The app shows demo data until keys are added — no errors, just sample numbers.
