# Deploying on a shared Hostinger KVM 1 (oaumaths.online)

This guide installs the site on a VPS that already hosts something else. It is
written as a launch-grade deployment (own user, own database, own port, HTTPS,
backups, cron), so what you test is what you will run.

It never edits the existing site. The only shared pieces are Nginx (we add one
new site file) and the disk. Everything else is separate.

| Thing | Existing site | This site |
|---|---|---|
| Port | 3000 | 3100 (bound to 127.0.0.1) |
| Linux user | root (PM2) | `maths` |
| Process manager | PM2 | systemd unit `oaumaths` |
| Node | v20 (global) | v24 in `/opt/node24`, used only by this site |
| Database | none | PostgreSQL 16, database `oaumaths`, local only |
| Files | unknown | `/opt/oaumaths`, `/var/private-storage`, `/etc/oaumaths` |

Facts taken from the server on 2026-11-12: Ubuntu 24.04, 1 vCPU, 3.8 GB RAM,
no swap, 45 GB free, Nginx 1.24 on ports 80 and 443, existing Next.js app on 3000.

All commands run on the VPS over SSH, as root, unless a step says otherwise.
Replace `VPS_IP` with the server's public IPv4 address.

## 0. Safety first

1. In the Hostinger panel, VPS, Snapshots: take a snapshot. If anything goes
   wrong you can restore the existing site from it.
2. Look at how the existing site is set up, so we do not collide with it:

   ```bash
   ls /etc/nginx/sites-enabled/ /etc/nginx/conf.d/
   grep -rn "server_name" /etc/nginx/sites-enabled/ /etc/nginx/conf.d/
   ```

   If another site already uses the name `oaumaths.online`, stop and tell me.

## 1. DNS

At the registrar (or DNS provider) of `oaumaths.online` add:

| Type | Name | Value |
|---|---|---|
| A | `@` | VPS_IP |
| A | `www` | VPS_IP |

Wait until `nslookup oaumaths.online` returns VPS_IP. Certbot (step 8) fails
before that. The Resend records come later (step 11).

## 2. Swap and packages

The server has no swap. The build needs memory headroom, and swap protects the
existing site from being killed if memory runs short.

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

```bash
apt-get update
apt-get install -y postgresql postgresql-contrib rsync git xz-utils certbot python3-certbot-nginx
```

This does not touch Nginx or the existing app. PostgreSQL listens on localhost
only by default.

## 3. User, directories, Node 24

```bash
adduser --system --group --home /opt/oaumaths --shell /bin/bash maths
mkdir -p /opt/oaumaths /etc/oaumaths /var/private-storage /var/log/oaumaths /var/backups/oaumaths
chown maths:maths /opt/oaumaths /var/log/oaumaths /var/backups/oaumaths
chown maths:maths /var/private-storage && chmod 700 /var/private-storage
```

Node 24, installed to its own folder with a checksum check. The global Node 20
is not changed.

```bash
cd /tmp
curl -fsSLO https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
F=$(grep -o 'node-v24[^ ]*-linux-x64.tar.xz' SHASUMS256.txt | head -1)
curl -fsSLO "https://nodejs.org/dist/latest-v24.x/$F"
grep " $F\$" SHASUMS256.txt | sha256sum -c -
mkdir -p /opt/node24 && tar -xJf "$F" -C /opt/node24 --strip-components=1
/opt/node24/bin/node -v     # expect v24.x
```

## 4. PostgreSQL database

Generate a password and keep it for step 5.

```bash
DBPASS=$(openssl rand -hex 24); echo "$DBPASS"
sudo -u postgres psql -c "CREATE ROLE oaumaths LOGIN PASSWORD '$DBPASS';"
sudo -u postgres psql -c "CREATE DATABASE oaumaths OWNER oaumaths;"
sudo -u postgres psql -d oaumaths -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

The connection string is:

```
postgresql://oaumaths:<DBPASS>@127.0.0.1:5432/oaumaths
```

## 5. Code and environment

Get the code as the `maths` user. If the GitHub repository is private, add a
read-only deploy key first (GitHub repo, Settings, Deploy keys) and clone with
the SSH URL.

```bash
sudo -u maths git clone https://github.com/Ahavatech/math.git /opt/oaumaths/repo
```

Create the environment file from the template, then edit it:

```bash
cp /opt/oaumaths/repo/deploy/shared-vps/env.example /etc/oaumaths/env
chown root:maths /etc/oaumaths/env && chmod 640 /etc/oaumaths/env
openssl rand -base64 32      # paste as AUTH_SECRET
nano /etc/oaumaths/env
```

Fill in `DATABASE_URL` (step 4), `AUTH_SECRET`, `SEED_ADMIN_EMAIL`. Leave the
Cloudinary and Resend values as the placeholders until step 11. The app starts
with them, but image uploads and emails will not work yet.

Never commit this file. It is outside the repository on purpose.

## 6. First database setup and build

Run as the `maths` user. The build prerenders pages from the database, so the
seed and import must come first. The first build takes several minutes on one
vCPU and slows the existing site a little while it runs.

```bash
sudo -u maths bash -c 'export PATH=/opt/node24/bin:$PATH; cd /opt/oaumaths/repo; set -a; . /etc/oaumaths/env; set +a; npm ci --include=dev && npx prisma migrate deploy && SEED_MODE=production npx prisma db seed && npm run db:import-legacy'
```

This is one non-interactive command on purpose. Do not use `sudo -u maths -i`
and paste more lines after it: that opens a shell as `maths`, and every later
line (including the root-only steps) then runs as `maths` and fails.

`--include=dev` is needed because the build uses dev dependencies and
`NODE_ENV=production` is set in the environment file.

The build itself happens in step 7, once the service exists.

## 7. Service, first build and start

Install the service and the one sudo rule that lets the update script restart it:

```bash
cp /opt/oaumaths/repo/deploy/shared-vps/oaumaths.service /etc/systemd/system/
echo 'maths ALL=(root) NOPASSWD: /usr/bin/systemctl restart oaumaths' > /etc/sudoers.d/oaumaths
chmod 440 /etc/sudoers.d/oaumaths && visudo -cf /etc/sudoers.d/oaumaths
systemctl daemon-reload
systemctl enable oaumaths
```

Build, publish to `/opt/oaumaths/app`, start and health check, using the same
script you will use for every later update:

```bash
sudo -u maths bash /opt/oaumaths/repo/deploy/shared-vps/update.sh
```

Expect `{"status":"ok"}` near the end. If the service does not start:
`journalctl -u oaumaths -n 50 --no-pager`.

If it does not start: `journalctl -u oaumaths -n 50 --no-pager`.

## 8. Nginx and HTTPS

```bash
cp /opt/oaumaths/repo/deploy/shared-vps/nginx-zones.conf /etc/nginx/conf.d/oaumaths-zones.conf
cp /opt/oaumaths/repo/deploy/shared-vps/nginx-site.conf /etc/nginx/sites-available/oaumaths
ln -s /etc/nginx/sites-available/oaumaths /etc/nginx/sites-enabled/oaumaths
nginx -t && systemctl reload nginx
certbot --nginx -d oaumaths.online -d www.oaumaths.online --agree-tos -m YOUR_EMAIL --redirect
```

`nginx -t` must say "successful" before you reload. The zone names are prefixed
`oaumaths_` so they cannot clash with anything the existing site defines.

Open https://oaumaths.online. Open the old site too, to confirm it is unchanged.

## 9. First admin

The seed created your `SEED_ADMIN_EMAIL` user without a password. Once Resend
works (step 11) use "Forgot password". Until then, set one directly:

```bash
sudo -u maths bash -c 'export PATH=/opt/node24/bin:$PATH; cd /opt/oaumaths/repo; set -a; . /etc/oaumaths/env; set +a; unset NODE_ENV; npx tsx scripts/set-admin-password.ts YOUR_EMAIL "a-long-password-of-10-plus-characters"'
```

## 10. Cron jobs and backups

```bash
cp /opt/oaumaths/repo/deploy/shared-vps/logrotate-oaumaths /etc/logrotate.d/oaumaths
crontab -u maths /opt/oaumaths/repo/deploy/shared-vps/crontab.txt
crontab -u maths -l | head
```

Run one backup by hand and look at the output:

```bash
sudo -u maths bash -c 'set -a; . /etc/oaumaths/env; set +a; /opt/oaumaths/repo/deploy/backup-scripts/daily-backup.sh'
ls -la /var/backups/oaumaths/
```

Backups live on the same disk as the site. That protects against mistakes, not
against losing the server. Also enable Hostinger's automatic backups or weekly
snapshots, and copy `/var/backups/oaumaths` somewhere else now and then.
Manuscripts are in `/var/private-storage`, which the backup job includes.

## 11. Resend and Cloudinary (accounts you create)

Resend:
1. Add the domain `oaumaths.online` in Resend (Domains).
2. Add the DNS records Resend shows (SPF, DKIM, optionally DMARC) at your DNS
   provider and wait for "Verified".
3. Create an API key. In `/etc/oaumaths/env` set `RESEND_API_KEY` and
   `EMAIL_FROM=noreply@oaumaths.online`.

Cloudinary: create a free account, copy cloud name, API key and API secret into
the three `CLOUDINARY_*` lines.

Then `systemctl restart oaumaths`. No rebuild is needed for these values.

## 12. Check everything

- `https://oaumaths.online` loads with a valid certificate, and the old site is unaffected.
- `curl -sI https://oaumaths.online | grep -i content-security` shows the CSP.
- Log in at `/login`, open `/admin`, upload a photo (Cloudinary), invite a test
  lecturer (Resend).
- `free -h` while browsing: the box should keep well over 1 GB available.
- `systemctl status oaumaths` is active, and `crontab -u maths -l` lists the jobs.

## Updating later

```bash
sudo -u maths bash /opt/oaumaths/repo/deploy/shared-vps/update.sh
```

It pulls the latest `main`, installs, migrates, builds into a staging folder,
copies the finished build to `/opt/oaumaths/app`, restarts, and checks health.
The live site keeps running during the build because the service runs from
`/opt/oaumaths/app`, not from the build folder.

## Undoing it

Nothing here touched the existing site. To remove this one:

```bash
systemctl disable --now oaumaths
rm /etc/nginx/sites-enabled/oaumaths && nginx -t && systemctl reload nginx
```

Optionally drop the database (`sudo -u postgres dropdb oaumaths`) and delete
`/opt/oaumaths`, `/etc/oaumaths` and `/var/private-storage`. The last one holds
manuscripts, so only delete it if there is nothing real in it.

## Limits to know about

- One vCPU and 3.8 GB shared by two sites and a database is enough for a
  department site. A traffic spike on either site slows both. The service has a
  1 GB memory cap so a leak here cannot take the other site down.
- A reboot restarts everything automatically (systemd and PM2 both start on boot).
- Real launch on a university domain: add that domain to `server_name` and
  re-run certbot, and set `AUTH_URL` and `NEXT_PUBLIC_SITE_URL` to it, then run
  `update.sh` (the public URL is baked in at build time).
