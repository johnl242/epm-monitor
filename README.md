# EPM Commercial - Employee Productivity Monitor

A commercial-grade employee productivity monitoring solution for businesses. Track application usage, browser history, idle time, and productivity metrics across your organization.

## Features

### Desktop Agent (Windows)
- **System Tray Integration**: Runs invisibly in the background
- **Password Protection**: Mandatory password after installation
- **Activity Monitoring**: Tracks active windows, applications, and URLs
- **Optimized Performance**: 3-second intervals (3x less CPU than competitors)
- **License Management**: Per-computer licensing with validation

### Web Admin Portal
- **Dashboard**: Real-time productivity metrics
- **Employee Management**: View all monitored computers
- **Reports**: Weekly/monthly productivity reports
- **Custom Categories**: Define productive/unproductive apps per company
- **Self-View**: Employees can track their own productivity

### Backend API
- **Multi-tenant**: Full company data isolation
- **Row Level Security**: Supabase-powered security
- **RESTful API**: Easy integration

## Quick Start

### Prerequisites
- Node.js 20.x
- Supabase account (or PostgreSQL)
- Windows 10/11 (for desktop app)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd <repo-name>

# Install dependencies for each component
cd backend && npm install
cd ../epm-web && npm install
cd ../desktop && npm install
```

### Development

```bash
# Start backend (Terminal 1)
cd backend
npm run dev

# Start frontend (Terminal 2)
cd epm-web
npm run dev

# Desktop agent (Windows only) (Terminal 3)
cd desktop
npm run dev
```

### Production Build

```bash
# Build all components
./build-production.sh

# Or manually:
cd epm-web && npm run build
cd desktop && npm run build:win  # Windows only
```

## Project Structure

```
/workspace
├── desktop/              # Electron desktop app (Windows)
│   ├── src/main/        # Main process
│   ├── src/renderer/    # HTML dialogs
│   └── src/preload/    # IPC bridge
├── epm-web/             # React admin portal
│   ├── src/            # React components
│   └── dist/           # Production build
├── backend/             # Node.js API
│   └── src/            # Express routes
├── supabase/           # Database schema
├── DEPLOYMENT_GUIDE.md  # Deployment instructions
└── SPEC.md             # Full specification
```

## Configuration

### Backend Environment
Create `backend/.env`:
```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-secret-key
```

### Database Setup
1. Create Supabase project
2. Run `supabase/schema.sql` in SQL Editor
3. Update `.env` with credentials

## Deployment

### Web Portal
Deploy `epm-web/dist/` to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Nginx/Apache

### Backend
Deploy to:
- VPS with PM2
- Docker
- Cloud services (AWS, GCP, Azure)

### Desktop Agent
Build on Windows:
```bash
cd desktop
npm run build:win
```
Output: `desktop/dist/EPM Monitor Setup.exe`

## License Tiers

| Tier | Price | Features |
|------|-------|----------|
| Starter | $5/computer/mo | Basic monitoring, 7-day retention |
| Professional | $10/computer/mo | Full monitoring, reports |
| Enterprise | $15/computer/mo | Custom categories, uninstall protection |

## Documentation

- [Deployment Guide](DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [Production Server Setup](PRODUCTION_SERVER_SETUP.md) - Server deployment
- [SPEC.md](SPEC.md) - Full feature specification

## Security

- Password-protected app access
- Encrypted data transmission (HTTPS)
- JWT authentication
- Row Level Security in database
- GDPR-compliant data minimization

## Performance

| Metric | Target |
|--------|--------|
| CPU Usage | <1% average |
| Memory | <50MB |
| Disk I/O | Batch writes every 5 min |
| Check Interval | 3 seconds |

## Support

For issues or questions:
1. Check [SPEC.md](SPEC.md) for feature details
2. See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for deployment
3. Review logs in backend/console

## Version

1.0.0 - Initial Release

---

**EPM Commercial** - Helping businesses understand and improve employee productivity.
