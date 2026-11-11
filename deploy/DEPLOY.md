# Deployment Guide

Step-by-step guide to deploy the OAU Mathematics website on a KVM 1 VPS behind Nginx. The final topology (where PostgreSQL runs, whether the university host fronts the site) is still open in docs/DECISIONS.md; this guide assumes PostgreSQL on the same VPS.

## Prerequisites

- KVM 1 VPS (Ubuntu 24.04 LTS)
- PostgreSQL 16 on the same VPS (or a managed instance, if decided later)
- Domain `maths.oauife.edu.ng` pointing to the VPS's public IP
- Cloudinary account (free tier)
- Resend account with a verified sending domain

## 1. Server setup

SSH into the VM:

```bash
ssh user@<VPS_IP>
```

### Install Node.js 24

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # should print v24.x
```

### Install Nginx and Certbot

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### Install PM2

```bash
sudo npm install -g pm2
```

### Create directories

```bash
sudo mkdir -p /opt/maths-oau
sudo mkdir -p /var/private-storage
sudo mkdir -p /var/backups/maths-oau
sudo mkdir -p /var/log/maths-oau
sudo chown $USER:$USER /opt/maths-oau /var/private-storage /var/backups/maths-oau /var/log/maths-oau
```

## 2. Build and deploy the app

On your **local machine**, build the standalone output:

```bash
cd math-main-check
npm ci
npm run build
```

Copy to the server:

```bash
# Copy the standalone build
rsync -az .next/standalone/ user@<VM_IP>:/opt/maths-oau/

# Copy static assets into the standalone folder
rsync -az .next/static/ user@<VM_IP>:/opt/maths-oau/.next/static/
rsync -az public/ user@<VM_IP>:/opt/maths-oau/public/

# Copy deploy configs and scripts
rsync -az deploy/ user@<VM_IP>:/opt/maths-oau/deploy/
rsync -az scripts/ user@<VM_IP>:/opt/maths-oau/scripts/
rsync -az tests/shims/ user@<VM_IP>:/opt/maths-oau/tests/shims/
rsync -az prisma/ user@<VM_IP>:/opt/maths-oau/prisma/
rsync -az src/lib/ user@<VM_IP>:/opt/maths-oau/src/lib/
```

## 3. Configure environment

On the server, create the `.env` file:

```bash
cat > /opt/maths-oau/.env << 'EOF'
NODE_ENV=production
PORT=3000

# PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/oau_maths

# Auth.js — generate with: openssl rand -base64 32
AUTH_SECRET=<generate-a-secret>
AUTH_URL=https://maths.oauife.edu.ng

# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Resend
RESEND_API_KEY=re_your-key
EMAIL_FROM=noreply@maths.oauife.edu.ng

# Private storage for manuscripts
PRIVATE_STORAGE_DIR=/var/private-storage

# Public site URL
NEXT_PUBLIC_SITE_URL=https://maths.oauife.edu.ng

# Admin seed email
SEED_ADMIN_EMAIL=admin@oauife.edu.ng
EOF
```

## 4. Run database migrations

```bash
cd /opt/maths-oau
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

## 5. Configure Nginx

```bash
# Copy the config
sudo cp /opt/maths-oau/deploy/nginx/maths-oau.conf /etc/nginx/sites-available/maths-oau

# Add rate limit zones to nginx.conf
sudo sed -i '/http {/a \    limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;\n    limit_req_zone $binary_remote_addr zone=api:10m rate=5r/s;\n    limit_req_zone $binary_remote_addr zone=search:10m rate=2r/s;' /etc/nginx/nginx.conf

# Enable the site
sudo ln -sf /etc/nginx/sites-available/maths-oau /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### SSL with Certbot

```bash
sudo certbot --nginx -d maths.oauife.edu.ng
# Follow the prompts, select redirect HTTP to HTTPS
```

Certbot auto-renews via a systemd timer. Verify:

```bash
sudo certbot renew --dry-run
```

## 6. Start the app with PM2

```bash
cd /opt/maths-oau
pm2 start deploy/process-manager/ecosystem.config.cjs
pm2 save
pm2 startup
# Run the command PM2 prints (starts PM2 on boot)
```

### Verify

```bash
curl -s http://127.0.0.1:3000/api/health
# Should return: {"status":"ok"}

curl -sI https://maths.oauife.edu.ng | head -20
# Should show 200 OK with CSP header
```

## 7. Set up cron jobs

```bash
# Edit crontab
crontab -e

# Add these lines (times are UTC; WAT = UTC+1):
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin
DATABASE_URL=postgresql://user:password@localhost:5432/oau_maths
PRIVATE_STORAGE_DIR=/var/private-storage
RESEND_API_KEY=re_your-key
EMAIL_FROM=noreply@maths.oauife.edu.ng

# Backup — daily at 02:00 UTC (03:00 WAT)
0 2 * * * /opt/maths-oau/deploy/backup-scripts/daily-backup.sh >> /var/log/maths-oau/backup.log 2>&1

# Alumni cleanup — daily at 03:00 UTC
0 3 * * * cd /opt/maths-oau && npx tsx scripts/alumni-cleanup-orphans.ts --apply >> /var/log/maths-oau/cron.log 2>&1

# Alumni purge rejected — daily at 03:15 UTC
15 3 * * * cd /opt/maths-oau && npx tsx scripts/alumni-purge-rejected.ts --apply >> /var/log/maths-oau/cron.log 2>&1

# Contact purge archived — daily at 03:30 UTC
30 3 * * * cd /opt/maths-oau && npx tsx scripts/contact-purge-archived.ts --apply >> /var/log/maths-oau/cron.log 2>&1

# Journal purge drafts — daily at 03:45 UTC
45 3 * * * cd /opt/maths-oau && npx tsx scripts/journal-purge-drafts.ts --apply >> /var/log/maths-oau/cron.log 2>&1

# Journal publish scheduled — every 15 minutes
*/15 * * * * cd /opt/maths-oau && npx tsx scripts/journal-publish-scheduled.ts --apply >> /var/log/maths-oau/cron.log 2>&1

# Journal review reminders — daily at 08:00 UTC (09:00 WAT)
0 8 * * * cd /opt/maths-oau && npx tsx scripts/journal-review-reminders.ts --apply >> /var/log/maths-oau/cron.log 2>&1

# Private storage orphan cleanup — weekly Sunday at 04:00 UTC
0 4 * * 0 cd /opt/maths-oau && npx tsx scripts/private-storage-orphans.ts --apply >> /var/log/maths-oau/cron.log 2>&1
```

Make the backup script executable:

```bash
chmod +x /opt/maths-oau/deploy/backup-scripts/daily-backup.sh
```

## 8. VPS notes

### Swap space (recommended on a small VPS)

Add swap if the VPS has little RAM:

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 9. Updating the site

When you push code changes:

```bash
# On your local machine
npm run build

# Sync to server
rsync -az --delete .next/standalone/ user@<VM_IP>:/opt/maths-oau/
rsync -az .next/static/ user@<VM_IP>:/opt/maths-oau/.next/static/
rsync -az public/ user@<VM_IP>:/opt/maths-oau/public/

# On the server
ssh user@<VM_IP>
cd /opt/maths-oau
npx prisma migrate deploy   # if there are new migrations
pm2 restart maths-oau
```

## 10. Monitoring

```bash
# App status
pm2 status
pm2 logs maths-oau

# Error logs
tail -f /var/log/maths-oau/error.log

# Cron logs
tail -f /var/log/maths-oau/cron.log

# Disk usage (watch private storage)
du -sh /var/private-storage/
df -h
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| App won't start | Check `pm2 logs maths-oau` for missing env vars |
| 502 Bad Gateway | `pm2 status` — is the app running? Check port 3000 |
| SSL cert expired | `sudo certbot renew` — should auto-renew |
| Database connection error | Check DATABASE_URL and that `systemctl status postgresql` is active |
| Disk full | Check `/var/private-storage` size; run orphan cleanup |
| Cron not running | `crontab -l` to verify; check `/var/log/maths-oau/cron.log` |
