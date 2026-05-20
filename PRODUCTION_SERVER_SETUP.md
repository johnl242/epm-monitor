# EPM Commercial - Production Server Setup

This guide provides step-by-step instructions for deploying EPM Commercial to a production server.

---

## Prerequisites

- Ubuntu 20.04+ server with root/sudo access
- Domain name pointed to server IP
- Nginx installed
- Node.js 20.x installed
- Supabase account (or PostgreSQL database)

---

## Step 1: Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx

# Install PM2 for process management
sudo npm install -g pm2
```

---

## Step 2: Database Setup (Supabase)

1. Go to https://supabase.com and create a project
2. Get your Project URL and keys from Settings > API
3. In Supabase SQL Editor, run the contents of `supabase/schema.sql`
4. Save your credentials for the next step

---

## Step 3: Backend Deployment

```bash
# Create application directory
sudo mkdir -p /var/www/epm-backend
sudo chown $USER:$USER /var/www/epm-backend

# Clone/copy backend files
cd /var/www/epm-backend

# Create environment file
cat > .env << EOF
PORT=3000
NODE_ENV=production
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
JWT_SECRET=your-production-secret-key-min-32-chars
CORS_ORIGIN=https://yourdomain.com
EOF

# Install dependencies
npm install

# Start with PM2
pm2 start src/index.js --name epm-backend

# Enable on startup
pm2 startup
pm2 save
```

---

## Step 4: Nginx Configuration

```bash
# Create nginx config
sudo nano /etc/nginx/sites-available/epm-api
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/epm-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Enable SSL (using Certbot)
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

---

## Step 5: Web Portal Deployment

```bash
# Create web directory
sudo mkdir -p /var/www/epm-web
sudo chown $USER:$USER /var/www/epm-web

# Build the web app (on your local machine, copy the dist folder)
# Or clone and build on server:

cd /var/www/epm-web
git clone <your-repo> .
npm install
npm run build

# Configure nginx
sudo nano /etc/nginx/sites-available/epm-web
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/epm-web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/epm-web /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Enable SSL
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## Step 6: Update Web Portal API URL

Update the frontend to point to your backend:

```javascript
// In your API service file
const API_BASE_URL = 'https://api.yourdomain.com';
```

Rebuild and deploy:
```bash
cd /var/www/epm-web
npm run build
sudo systemctl reload nginx
```

---

## Step 7: Desktop App Distribution

### Building the Windows Installer

1. On a Windows machine with Node.js 20.x:
```powershell
cd desktop
npm install
npm run build:win
```

2. The installer will be at: `dist/EPM Monitor Setup.exe`

### Distributing to Employees

Options:
1. **Direct download**: Host the .exe on your website
2. **Email**: Send download link
3. **Active Directory**: Deploy via GPO
4. **MDM**: Use mobile device management

---

## Step 8: License Key Generation

Create license keys in your database:

```sql
-- Insert test license
INSERT INTO licenses (company_id, license_key, tier, seats, is_active, expires_at)
VALUES (
    'your-company-id',
    'XXXX-XXXX-XXXX-XXXX',
    'professional',
    50,
    true,
    '2025-12-31'
);
```

---

## Monitoring & Logs

```bash
# View backend logs
pm2 logs epm-backend

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Monitor server resources
htop
```

---

## Updating

```bash
# Backend
cd /var/www/epm-backend
git pull
npm install
pm2 restart epm-backend

# Frontend
cd /var/www/epm-web
git pull
npm install
npm run build
sudo systemctl reload nginx
```

---

## Troubleshooting

### Backend won't start
```bash
pm2 logs epm-backend
# Check .env configuration
```

### Can't connect to database
```bash
# Test Supabase connection
curl https://your-project.supabase.co/rest/v1/
```

### SSL issues
```bash
sudo certbot --nginx -d api.yourdomain.com --reinstall
```

---

## Security Checklist

- [ ] Enable HTTPS (SSL)
- [ ] Set strong JWT_SECRET
- [ ] Configure CORS properly
- [ ] Enable rate limiting
- [ ] Set up database backups (Supabase has auto-backups)
- [ ] Enable firewall (ufw)
- [ ] Regular system updates

---

## Support

For issues, check:
- `/workspace/DEPLOYMENT_GUIDE.md`
- `/workspace/SPEC.md`
- Backend logs: `pm2 logs epm-backend`