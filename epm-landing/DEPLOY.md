# EPM Landing — Deploy to Cloudflare Pages

## 1. Run the landing SQL migration

In Supabase SQL Editor, run `supabase/migration_landing.sql` to create:
- `purchase_leads` — stores buy modal submissions
- `download_releases` — tracks installer URLs shown on landing
- `app_settings` — payment gateway keys stored by admin panel

## 2. Deploy to Cloudflare Pages

### Option A: GitHub-connected (recommended)

1. Push `/epm-landing/` to a GitHub repo
2. Go to [Cloudflare Pages](https://pages.cloudflare.com) → **Create a project**
3. Connect your GitHub repo
4. Set build settings:
   - **Build command**: *(leave empty — static site)*
   - **Build output directory**: `/` (root)
5. Deploy

### Option B: Direct upload (wrangler CLI)

```bash
cd /path/to/EMS/epm-landing
npx wrangler pages deploy . --project-name epm-landing
```

## 3. Configure payment gateways

After deploying, log into the admin panel at `/superuser.html` and go to **Settings** to enter:

- **Stripe Publishable Key**: `pk_live_...`  
- **Stripe Secret Key**: `sk_live_...`  
- **Razorpay Key ID**: `rzp_live_...`  
- **Razorpay Key Secret**: your secret

Then update the `STRIPE_PK` and `RAZORPAY_KEY` constants in `index.html` with your live keys, and implement a Cloudflare Worker to create Stripe Checkout sessions and Razorpay orders server-side.

## 4. Set up Windows download URL

1. Build the Windows EXE via GitHub Actions (push a `v*` tag to the EMS repo)
2. Copy the release URL from GitHub Releases
3. In the admin panel → **Settings** → **Download Release Management**, enter the version and URL and click **Publish Release**

## 5. Admin panel credentials

Login at `/superuser.html` with the credentials from `super_admins` table.
Default: `admin@epm-monitor.com` / `Admin@123`

**Change the password immediately after first login.**

## File structure

```
epm-landing/
├── index.html       # Landing page (hero, features, pricing, download)
├── superuser.html   # Admin panel (Supabase-backed, bcrypt auth)
├── _redirects       # Cloudflare Pages routing
├── wrangler.toml    # Cloudflare config
└── DEPLOY.md        # This file
```
