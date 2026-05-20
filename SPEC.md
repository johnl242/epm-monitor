# Employee Productivity Monitor (EPM) - Commercial Edition

## 1. Project Overview

### Project Name
**EPM Commercial** - Employee Productivity Monitor

### Project Type
Multi-tenant SaaS Desktop Application with Web Admin Portal

### Core Feature Summary
A commercial employee monitoring solution that tracks computer activity (application usage, browser history, idle time) and provides companies with comprehensive productivity analytics through a secure web dashboard.

### Target Users
- **Primary**: Companies seeking employee productivity insights
- **Secondary**: Remote teams, IT administrators, HR departments
- **Commercial Model**: Multi-tenant SaaS with license-per-computer pricing

---

## 2. System Architecture

### Components
1. **Desktop Agent (Windows)**: System tray application with monitoring capabilities
2. **Backend API**: Node.js server with Supabase database
3. **Web Admin Portal**: React-based multi-tenant dashboard

### Data Flow
```
[Desktop Agent] --> [Encrypted HTTPS] --> [Backend API] --> [Supabase DB]
                                                              |
                                                              v
                                                    [Web Admin Portal]
```

---

## 3. Desktop Application Specification

### 3.1 System Tray Features
- **Tray Icon**: Custom icon showing monitoring status
- **Context Menu**:
  - View Status
  - Pause Monitoring (password protected)
  - Resume Monitoring
  - Settings (password protected)
  - Help/About
  - Exit (password protected)

### 3.2 Password Protection
- **Initial Setup**: Mandatory password creation after first install
- **Protection Scope**:
  - Cannot pause/stop monitoring without password
  - Cannot access settings without password
  - Cannot uninstall without password
  - Cannot modify registry/autostart entries
- **Password Storage**: bcrypt hash stored in system registry (admin-only access)

### 3.3 Uninstallation Protection
- **Windows Add/Remove Programs**:
  - Application entry hidden or requires password
  - Custom uninstaller that verifies admin password
- **Registry Protection**:
  - Auto-start entries protected
  - Service entries protected
- **Process Protection**:
  - Application cannot be killed without password
  - Restart on crash/forced termination

### 3.4 Monitoring Capabilities
| Feature | Implementation |
|---------|----------------|
| Application Tracking | Active window detection, usage duration |
| Browser Monitoring | URL extraction from Chrome, Edge, Firefox |
| Idle Detection | Mouse/keyboard inactivity timeout (configurable) |
| Screenshot Capture | Periodic screenshots (configurable interval) |
| Activity Levels | Active, Idle, Away categorization |
| Network Activity | Basic network usage tracking |

### 3.5 Data Collection
- **Local Storage**: SQLite database on client
- **Sync Interval**: Configurable (default: 5 minutes)
- **Data Format**:
```json
{
  "timestamp": "ISO8601",
  "active_app": "Application Name",
  "app_title": "Window Title",
  "url": "https://...",
  "idle_seconds": 0,
  "screenshot_hash": "sha256"
}
```

### 3.6 License Management
- **License Key**: 16-character alphanumeric key
- **Validation**: Online validation against backend
- **Computer Binding**: Hardware ID (CPU + HDD serial)
- **Expiration**: Tracks license expiry date

---

## 4. Web Admin Portal Specification

### 4.1 Multi-Tenant Architecture
- **Company Isolation**: Each company has isolated data
- **Role-Based Access**: Admin, Manager, Viewer roles
- **Company Management**: Create, configure, license companies

### 4.2 Dashboard Features
| Module | Features |
|--------|----------|
| Overview | Total employees, active/idle ratio, top apps |
| Activity | Real-time activity feed, timeline view |
| Applications | Most used apps, productivity categorization |
| Websites | Browsing history, category breakdown |
| Reports | Daily/weekly/monthly productivity reports |
| Settings | Monitor config, alert thresholds, categories |

### 4.3 Employee Features
- **Employee Profile**: Name, email, department, computer
- **Activity Timeline**: Visual daily/weekly activity
- **Productivity Score**: Calculated based on app categories
- **Self-View Option**: Employees can see their own stats

### 4.4 Analytics & Metrics
- **Productivity Score**: 0-100 based on productive vs unproductive time
- **Focus Time**: Uninterrupted work periods
- **Collaboration Time**: Meeting apps, communication tools
- **Idle Time**: Inactive periods
- **Trends**: Day-over-day, week-over-week comparisons

---

## 5. Technical Specification

### 5.1 Desktop Application
- **Framework**: Electron 28.x (for Windows)
- **Language**: JavaScript/TypeScript
- **UI**: Native system tray + minimal React UI
- **Database**: SQLite (better-sqlite3)
- **Packaging**: electron-builder

### 5.2 Backend
- **Runtime**: Node.js 20.x
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT with role-based access
- **API Style**: RESTful

### 5.3 Web Portal
- **Framework**: React 18.x + Vite
- **UI Library**: Tailwind CSS + shadcn/ui
- **State**: React Query for server state
- **Charts**: Recharts for visualizations

### 5.4 Security
- **Desktop**: AES-256 encryption for local data
- **Transport**: TLS 1.3 for API communication
- **Auth**: JWT with refresh tokens
- **Password**: bcrypt with salt rounds 12

---

## 6. Database Schema

### Tables
```sql
-- Companies
companies (id, name, domain, logo_url, settings_json, created_at)

-- Users (Company Admins/Managers)
users (id, company_id, email, password_hash, role, created_at)

-- Licenses
licenses (id, company_id, license_key, hardware_id, seats, expires_at, is_active)

-- Computers
computers (id, license_id, hostname, username, last_seen, created_at)

-- Activity Data
activity_logs (id, computer_id, timestamp, app_name, app_title, url, idle_seconds, screenshot_hash)

-- Daily Aggregates
daily_stats (id, computer_id, date, active_minutes, idle_minutes, productive_minutes, unproductive_minutes)
```

---

## 7. Commercial Features

### 7.1 License Tiers
| Tier | Price | Features |
|------|-------|----------|
| Starter | $5/computer/mo | Basic monitoring, 7-day retention |
| Professional | $10/computer/mo | Full monitoring, 30-day retention, reports |
| Enterprise | $15/computer/mo | Custom categories, unlimited retention, API |

### 7.2 Trial System
- 14-day free trial for new companies
- Limited features during trial
- Automated upgrade prompts

### 7.3 Invoice & Billing
- Monthly/annual billing cycles
- Seat-based pricing
- Usage-based alerts (80% capacity)

---

## 8. Implementation Priorities

### Phase 1 (MVP)
1. Desktop app with system tray and monitoring
2. Basic password protection
3. Local data storage
4. Simple web dashboard
5. Company/employee management

### Phase 2
1. License management system
2. Screenshot capture
3. Advanced analytics
4. Report generation

### Phase 3
1. Multi-tenant isolation
2. API integrations
3. Mobile viewing
4. Custom categories

---

## 9. Files Structure

```
/workspace
├── desktop/                    # Electron desktop app
│   ├── src/
│   │   ├── main/              # Main process
│   │   │   ├── index.js       # Entry point
│   │   │   ├── tray.js        # System tray
│   │   │   ├── monitor.js     # Activity monitoring
│   │   │   ├── database.js    # SQLite operations
│   │   │   └── auth.js        # Password protection
│   │   ├── preload/          # Preload scripts
│   │   └── renderer/         # React UI
│   ├── package.json
│   └── electron-builder.yml
│
├── backend/                    # Node.js API server
│   ├── src/
│   │   ├── index.js           # Express server
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Auth, validation
│   │   └── services/         # Business logic
│   └── package.json
│
├── web/                       # React web portal
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── pages/           # Route pages
│   │   ├── hooks/           # Custom hooks
│   │   └── services/        # API calls
│   ├── package.json
│   └── vite.config.js
│
├── supabase/                 # Database schema
│   └── schema.sql
│
└── SPEC.md
```

---

## 10. Success Criteria

1. **Desktop App**: Launches to system tray, monitors activity, password-protected
2. **Data Sync**: Activity data syncs to backend successfully
3. **Web Portal**: Shows real-time employee activity and reports
4. **Multi-tenant**: Companies are isolated, license enforcement works
5. **Commercial Ready**: License validation, trial system, tiered pricing

---

## 11. Performance Optimization (vs Competitors)

### Key Optimizations
| Feature | Hubstaff/Teramind Issue | EPM Solution |
|---------|------------------------|--------------|
| Window Check Interval | 1-second (high CPU) | 3-second intervals |
| Idle Detection | Frequent PowerShell calls | Separate 10-second check |
| Memory Usage | 100-200MB typical | <50MB target with caching |
| Database Writes | Per-activity insert | Batch transactions |
| PowerShell Overhead | Multiple scripts | Single optimized script |

### Resource Targets
- **CPU Usage**: <1% average when monitoring
- **Memory Footprint**: <50MB baseline
- **Disk I/O**: Batch writes every 5 minutes
- **Battery Impact**: Minimal (critical for laptop users)

---

## 12. Competitor Analysis Summary

### Market Leaders & Their Weaknesses
| Competitor | Pricing | Main Weakness |
|------------|---------|---------------|
| Hubstaff | $5-10/user/mo | High CPU usage, developer-unfriendly metrics |
| Teramind | $15-30/user/mo | Overwhelming UI, slow on low-end PCs |
| ActivTrak | $6-8/user/mo | Basic analytics, limited customization |
| Time Doctor | $6-8/user/mo | Battery drain on mobile, complex setup |

### User Complaints Addressed
1. **"Computer becomes sluggish"** → Optimized intervals, caching
2. **"Activity metrics meaningless for developers"** → Neutral category + custom rules
3. **"Too intrusive with screenshots"** → Disabled by default, optional
4. **"Battery drain"** → Lightweight idle detection

### EPM Differentiators
1. **Lightweight**: 3x less frequent polling than competitors
2. **Knowledge Worker Friendly**: Neutral activity as default, not punish thinking
3. **Transparency Option**: Employees can view their own productivity
4. **Flexible Categories**: Companies define what productive means for their role
5. **Low Resource**: Works on 4GB RAM systems without slowdown

---

## 13. Privacy & Compliance

### Privacy Features
- **Employee Dashboard**: Optional self-view of personal stats
- **Transparency Mode**: Show employees what data is collected
- **Data Minimization**: No keystrokes, no screenshots by default
- **Retention Limits**: Configurable data retention (7-90 days)

### Data Collected
- Window title and app name
- Activity duration per app
- Idle time
- Productivity category

### Data NOT Collected
- Keystrokes (disabled by default)
- Screenshots (opt-in only)
- Private browsing data
- Password fields

---

## 14. Notes

- Privacy compliance built-in (GDPR-friendly data minimization)
- Employee transparency option (self-view dashboard)
- Focus on productivity insights over surveillance
- Secure by design with encryption at rest and in transit
- Low resource design: works on low-end hardware without slowing down users

---

## 15. Deployment Guide

### Quick Start
```bash
# Start backend
cd /workspace/backend && npm run dev

# Start frontend
cd /workspace/epm-web && npm run dev

# Build desktop (Windows only)
cd /workspace/desktop && npm run build:win
```

### Production Build
```bash
./build-production.sh
```

### Key Files
| File | Purpose |
|------|---------|
| `DEPLOYMENT_GUIDE.md` | Complete deployment instructions |
| `PRODUCTION_SERVER_SETUP.md` | Production server setup |
| `start.sh` | Development quick start |
| `build-production.sh` | Production build script |

### Web Portal
- Deployed URL: https://aqxvfsbf6ay1.space.minimax.io
- Build: `npm run build` in epm-web/

### Backend
- Port: 3000
- Database: Supabase (PostgreSQL)
- Key files: `backend/src/index.js`

### Desktop Agent
- Platform: Windows only
- Build: `npm run build:win`
- Output: `desktop/dist/EPM Monitor Setup.exe`

---

## 16. License Tiers

| Tier | Price | Features |
|------|-------|----------|
| Starter | $5/computer/mo | Basic monitoring, 7-day retention |
| Professional | $10/computer/mo | Full monitoring, 30-day retention, reports |
| Enterprise | $15/computer/mo | Custom categories, unlimited retention, uninstall protection |

---

## 17. Support

- Documentation: See `DEPLOYMENT_GUIDE.md`
- Server Setup: See `PRODUCTION_SERVER_SETUP.md`
- Specifications: See this SPEC.md file
