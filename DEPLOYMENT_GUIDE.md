# EPM Commercial - Deployment Guide

## Architecture Overview

EPM Commercial uses **Supabase** (PostgreSQL + REST API) directly - no separate Node.js backend needed!

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  PostgreSQL     │  │  PostgREST      │  │  Auth           │  │
│  │  Database       │  │  (Auto API)     │  │  (Users/Sessions)│ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
              ▲              ▲                   ▲
              │              │                   │
              │         HTTPS REST                │  HTTPS
              ▼              ▼                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    YOUR DEPLOYED APPS                           │
│  ┌──────────────────────────────────┐  ┌──────────────────────┐ │
│  │  Desktop Agent (Electron)        │  │  Web Admin Portal    │ │
│  │  - Uses @supabase/supabase-js │  │  - Uses React + Vite │ │
│  │  - Syncs data to Supabase      │  │  - Connects to        │ │
│  │  - Installs on employee PCs    │  │    Supabase directly  │ │
│  └──────────────────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Web Admin Portal

### Development
```bash
cd /workspace/epm-web
npm install
npm run dev
```
Access at `http://localhost:5173`

### Production Build
```bash
cd /workspace/epm-web
npm run build
```
Output: `/workspace/epm-web/dist/`

### Deploy to Production
The dist folder can be deployed to any static hosting:
- **Vercel**: `vercel dist/`
- **Netlify**: `netlify deploy --prod --dir=dist`
- **S3/CloudFront**: Upload dist folder
- **Nginx**: Serve as static files

---

## Part 2: Desktop Agent (Electron)

### Prerequisites
- Windows 10/11
- Node.js 20.x
- npm or pnpm

### Development Mode
```bash
cd /workspace/desktop

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Production Build (Windows)

1. **Install build tools**:
```powershell
npm install -g electron-builder
```

2. **Build for Windows**:
```bash
cd /workspace/desktop
npm run build:win
```

3. **Output**: `desktop/dist/EPM Monitor Setup.exe`

### Building without this environment:
On a Windows machine with Node.js:
```bash
git clone <your-repo>
cd desktop
npm install
npm run build:win
```

---

## Part 3: Database Setup (Supabase)

### 1. Create Supabase Project
1. Go to https://supabase.com
2. Create new project
3. Note your Project URL and API keys

### 2. Run Schema
In Supabase SQL Editor, run the contents of `/workspace/supabase/schema.sql`

### 3. Update Configuration
Update Supabase credentials in:
- `desktop/src/main/supabase-client.js`
- `epm-web/src/lib/supabase.ts`

---

## Quick Start Commands

### Start Web Portal
```bash
cd /workspace/epm-web
npm run dev
```

### Desktop Agent (Windows only)
```bash
cd /workspace/desktop
npm install
npm run dev      # Development
npm run build:win  # Production build
```

---

## Environment Configuration

### Supabase Credentials
Update these files with your Supabase credentials:

**Desktop App** (`desktop/src/main/supabase-client.js`):
```javascript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

**Web Portal** (`epm-web/src/lib/supabase.ts`):
```typescript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGci...';
```

---

## Troubleshooting

### Web Portal Build Issues
```bash
cd /workspace/epm-web
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Desktop Build Issues
On Windows, ensure you have:
- Node.js 20.x
- Visual Studio Build Tools
- Run: `npm install --build-from-source`

---

## License Activation Flow

1. Admin downloads desktop app installer
2. Installs on employee computer
3. App connects to Supabase
4. Registers with company and license key
5. Monitoring begins
6. Data syncs to Supabase every minute

---

## Support & Documentation

- SPEC.md - Full feature specification
- /workspace/supabase/schema.sql - Database schema
- /workspace/SPEC.md - Complete project specification