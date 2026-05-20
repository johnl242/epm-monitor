# EPM Commercial - Employee Productivity Monitor

## Overview

EPM Commercial is a comprehensive employee productivity monitoring solution designed for commercial use by multiple companies. It consists of two main components:

1. **Desktop Agent** - Runs silently on employee computers, monitoring activity
2. **Web Admin Portal** - Companies access reports and analytics via web browser

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Employee PC    │     │   Supabase      │     │   Admin Portal  │
│  (Desktop App)  │────▶│   Cloud DB      │◀────│   (Web App)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
      │                         │                        │
      │  Activity Data          │  Sync                 │  Reports
      │  - App usage           │  - Real-time          │  - Dashboard
      │  - Browser history    │  - Per-company       │  - Employees
      │  - Idle time          │  - Per-seat license  │  - Activity
      │  - Screenshot         │                       │  - Categories
```

## Features

### Desktop Agent
- **System Tray Integration** - Runs silently in background, cannot be closed
- **Password Protection** - Requires password to access settings or uninstall
- **Uninstall Protection** - Cannot be removed via Windows Add/Remove Programs without password
- **Activity Monitoring**:
  - Application usage tracking (time spent per app)
  - Browser history monitoring
  - Idle time detection
  - Screenshot capture (optional)
- **Local Storage** - SQLite database for offline operation
- **Cloud Sync** - Automatic sync to Supabase every minute

### Web Admin Portal
- **Dashboard** - Real-time productivity metrics
- **Employees** - View all registered employees
- **Computers** - Monitor all registered computers
- **Live Activity** - Real-time employee activity feed
- **Categories** - Define productive/unproductive apps and websites
- **Settings** - Company configuration and license info

## Deployment URLs

| Component | URL |
|-----------|-----|
| **Web Portal** | https://0cf5iw5ndfoq.space.minimax.io |
| **Desktop App** | `/workspace/desktop/dist/win-unpacked/EPM Monitor.exe` |

## Quick Start

### 1. Access Web Portal
1. Open https://0cf5iw5ndfoq.space.minimax.io
2. Login with demo credentials:
   - **Email:** admin@demo.com
   - **Password:** admin123

### 2. Install Desktop Agent
1. Copy `EPM Monitor.exe` to employee computers
2. Run the installer
3. During setup, create an admin password
4. Enter company license key (or use demo key for testing)

### 3. View Activity
Once installed, employee activity will automatically sync to the cloud and appear in the web portal dashboard.

## Commercial Licensing Model

### License Tiers
| Tier | Seats | Price | Features |
|------|-------|-------|----------|
| Starter | 5 | $9/seat/mo | Basic monitoring |
| Professional | 50 | $7/seat/mo | Full features |
| Enterprise | Unlimited | Custom | White-label, API access |

### Per-Seat Licensing
- Each installed desktop agent consumes 1 seat
- License seats can be reassigned when employees leave
- Over-limit agents go into reduced-functionality mode

## Database Schema

### Supabase Tables

**companies**
- `id` (UUID, PK)
- `name` (TEXT)
- `license_tier` (TEXT)
- `license_seats` (INT)
- `license_expiry` (TIMESTAMP)

**computers**
- `id` (UUID, PK)
- `company_id` (UUID, FK)
- `hostname` (TEXT)
- `username` (TEXT)
- `last_seen` (TIMESTAMP)

**activity_logs**
- `id` (UUID, PK)
- `computer_id` (UUID, FK)
- `timestamp` (TIMESTAMP)
- `app_name` (TEXT)
- `app_title` (TEXT)
- `url` (TEXT)
- `category` (TEXT: productive/unproductive/neutral)
- `duration_seconds` (INT)

**employees**
- `id` (UUID, PK)
- `company_id` (UUID, FK)
- `computer_id` (UUID, FK)
- `name` (TEXT)
- `email` (TEXT)
- `department` (TEXT)

**productivity_rules**
- `id` (UUID, PK)
- `company_id` (UUID, FK)
- `name` (TEXT)
- `category` (TEXT)
- `type` (TEXT: app/domain/keyword)
- `pattern` (TEXT)

## Technical Stack

### Desktop Agent
- **Framework:** Electron 28.3.3
- **Database:** SQLite (better-sqlite3)
- **Cloud:** Supabase (@supabase/supabase-js)
- **Logging:** electron-log

### Web Portal
- **Framework:** React + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Backend:** Supabase (direct connection)

## Building from Source

### Prerequisites
- Node.js 20+
- pnpm 9+
- Windows (for building .exe)

### Desktop App
```bash
cd /workspace/desktop
pnpm install
pnpm run build:win
```

### Web Portal
```bash
cd /workspace/epm-web-fixed
pnpm install
pnpm run build
```

## Configuration

### Supabase Connection
The desktop app and web portal connect directly to Supabase using:
- URL: `https://fcfezhoaxqroubphzzfz.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Environment Variables (optional)
```env
SUPABASE_URL=https://fcfezhoaxqroubphzzfz.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Security Considerations

1. **Password Protection** - All desktop agents require admin password
2. **Uninstall Protection** - Cannot be removed without password
3. **Local Encryption** - Activity data encrypted at rest
4. **Row-Level Security** - Supabase RLS ensures data isolation per company

## Troubleshooting

### Desktop Agent Issues
- **Not appearing in tray:** Check if app is running via Task Manager
- **Sync not working:** Verify internet connection and Supabase credentials
- **Password not working:** Contact admin to reset

### Web Portal Issues
- **Login failed:** Check credentials or use demo login
- **No data showing:** Wait for desktop agents to sync (up to 1 minute)
- **Charts empty:** Ensure activity_logs table has data

## Support

For commercial inquiries and support:
- Email: support@epm-commercial.com
- Website: https://epm-commercial.com

---

**Version:** 1.0.0
**Last Updated:** 2026-05-13