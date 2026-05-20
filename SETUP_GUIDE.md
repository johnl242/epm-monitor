# EPM Commercial — Complete Setup Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL)                     │
│  companies · users · licenses · purchases · plans           │
│  computers · activity_logs · daily_stats · super_admins     │
└────────────┬────────────────────────┬───────────────────────┘
             │                        │
    ┌────────▼───────┐      ┌────────▼──────────┐
    │  epm-web       │      │  epm-admin         │
    │  Company Admin │      │  Super Admin       │
    │  (Firebase)    │      │  (Firebase)        │
    └────────────────┘      └───────────────────┘
                                      │ issues license keys
    ┌─────────────────────────────────▼──────────────────────┐
    │  EPM Monitor.exe  (Electron — Windows client)           │
    │  Validates license key → Supabase → registers seat      │
    │  Monitors activity → syncs to Supabase every 5 min     │
    └─────────────────────────────────────────────────────────┘
```

---

## Step 1 — Supabase Database Setup

1. Go to [supabase.com](https://supabase.com) and open your project (`fcfezhoaxqroubphzzfz`).
2. Open **SQL Editor**.
3. Run `supabase/schema.sql` first (if not already done).
4. Run `supabase/migration_v2.sql` — this adds `plans`, `purchases`, `super_admins` tables plus new columns.

After running migration_v2.sql you will have:
- **Default super admin:** `admin@epm.io` / `password` ← **change this immediately**
- **4 plans seeded:** Trial, Starter ($5), Professional ($10), Enterprise ($15)

### Change default super admin password

The default hash in `super_admins` is bcrypt for `"password"`. To set a proper password:

```sql
-- Generate hash at: https://bcrypt-generator.com  (12 rounds)
UPDATE super_admins
SET password_hash = '<your_bcrypt_hash>'
WHERE email = 'admin@epm.io';
```

---

## Step 2 — Super Admin Panel (epm-admin)

### Run locally

```bash
cd epm-admin
npm install
npm run dev
# Opens at http://localhost:5174
```

Login with `admin@epm.io` / `password`.

### Deploy to Firebase

```bash
# Install Firebase CLI (once)
npm install -g firebase-tools
firebase login

# Inside epm-admin/
npm run build
firebase deploy --project epm-commercial-app
```

> Update `.firebaserc` with your actual Firebase project ID before deploying.

### Workflow: Onboard a new company

1. **Companies → New Company** — enter company name, contact details
2. **Click the company row → View**
3. **Issue License** button → select plan, seats, duration
4. The panel generates a license key, records the purchase, and updates the company's tier
5. Copy the license key and send it to the company administrator
6. Company admin distributes the key to employees for agent installation

---

## Step 3 — Company Admin Portal (epm-web)

### Run locally

```bash
cd epm-web
npm install
npm run dev
# Opens at http://localhost:5173
```

### Deploy to Firebase

```bash
cd epm-web
npm run build
firebase deploy --project epm-commercial-app
```

For two separate Firebase sites (admin vs company portal) use `firebase.json` target names:

```json
{
  "hosting": [
    { "target": "company", "public": "dist", ... },
    { "target": "admin",   "public": "dist", ... }
  ]
}
```

### Register a company admin user in Supabase

After creating a company via the admin panel, create the company's admin user:

```sql
-- Get the company id first
SELECT id FROM companies WHERE name = 'Acme Corp';

-- Insert admin user (password: admin123 — tell them to change it)
INSERT INTO users (company_id, email, password_hash, name, role)
VALUES (
  '<company_uuid>',
  'admin@acme.com',
  '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Acme Admin',
  'admin'
);
```

---

## Step 4 — Windows Desktop Agent (EPM Monitor.exe)

### Prerequisites

- Windows build machine (or Windows VM)
- Node.js 18+ and npm

### Install dependencies

```bash
cd desktop
npm install
```

> **Note:** `better-sqlite3` is a native module. On Windows it compiles automatically via `node-gyp`. Make sure Visual Studio Build Tools are installed (`npm install -g windows-build-tools`).

### Build the installer

```bash
npm run build:win
# Output: desktop/dist/EPM Monitor Setup.exe
```

### Distribute

1. Send `EPM Monitor Setup.exe` to the company.
2. During installation, the employee enters the **license key** issued from the admin panel.
3. The agent validates the key against Supabase (checks active, not expired, seat limit not reached).
4. On success, the computer registers itself as a seat under the company's license.
5. Activity monitoring starts automatically.

### License key flow on the agent

```
Employee enters key → license.js → supabaseClient.validateAndRegisterLicense()
  → Supabase: SELECT * FROM licenses WHERE license_key = ? AND is_active = true
  → Count computers WHERE license_id = ? (seat check)
  → If seats available: allow, store key locally, register computer in Supabase
  → Periodic re-validation (1 hour cache) via validateLicenseKey()
```

### Seat enforcement

| Situation | Behaviour |
|-----------|-----------|
| Key not found | Blocked — error shown |
| Key expired | Blocked — renewal message |
| Seats full | Blocked — contact admin message |
| Company suspended | Blocked — contact support |
| Offline | Allowed (cached local license, 1 hour grace) |

---

## Step 5 — License Key Format

Keys are generated by `epm-admin/src/lib/supabase.ts → generateLicenseKey()`:

```
Format: <TIER><YYYYMM><8 hex chars>
Example: P202605A3F2C1D8E   ← Professional, May 2026
         E2026051A2B3C4D5   ← Enterprise
         S2026053E4F1A2B3   ← Starter
         T2026057F8E3A1B2   ← Trial
```

The key encodes no sensitive data — all enforcement happens server-side (Supabase).

---

## Environment / Config Summary

| Variable | Where set | Value |
|----------|-----------|-------|
| Supabase URL | hardcoded in all 3 apps | `https://fcfezhoaxqroubphzzfz.supabase.co` |
| Supabase anon key | hardcoded | see existing files |
| Firebase project | `.firebaserc` | `epm-commercial-app` (update to yours) |

> For production, move Supabase URL + anon key to environment variables (`.env` files + Vite's `import.meta.env`).

---

## Troubleshooting

**Agent says "Seat limit reached" but company has seats left**
→ Check `computers` table — there may be stale/duplicate rows. Delete entries where `hardware_id` is null or old.

**License key not found**
→ Verify the key in the `licenses` table. Check `is_active = true` and `expires_at` is in the future.

**Super admin login fails**
→ bcrypt hash mismatch. Regenerate the hash at bcrypt-generator.com (12 rounds) and update the row.

**epm-web shows no data after login**
→ The `users` table row must have a matching `company_id`. Check the email is correct and `password_hash` was generated with bcryptjs 12 rounds.

**Electron build fails on macOS (cross-compiling for Windows)**
→ `electron-builder` cannot cross-compile native modules. Use a Windows machine or GitHub Actions with a Windows runner.

---

## Quick Reference: File Map

```
EMS/
├── supabase/
│   ├── schema.sql          ← Run first (original schema)
│   └── migration_v2.sql    ← Run second (plans/purchases/super_admins)
├── epm-admin/              ← Super Admin Console (this guide's new app)
│   ├── src/App.tsx         ← All admin pages
│   └── src/lib/supabase.ts ← DB helpers + license generator
├── epm-web/                ← Company Admin Portal
│   ├── firebase.json       ← Firebase Hosting config
│   └── src/App.tsx         ← Existing company portal
├── desktop/
│   └── src/main/
│       ├── license.js      ← Updated: real server validation
│       └── supabase-client.js ← Updated: validateAndRegisterLicense()
└── SETUP_GUIDE.md          ← This file
```
