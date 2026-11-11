# Demo deployment (Neon + Render or Google Cloud)

Two options for the web server. The database is Neon either way (step 1).

- **Option B, Render (recommended for a quick demo):** jump to "Option B" at the end of this file after step 1 and step 3.
- **Option A, Google Cloud VM:** steps 2 and 4 to 7 below. Google may ask for a prepayment or card; check before you start.

A short-lived setup to show the site to the HOD. It is not the production
plan: there are no cron jobs, no off-VM backups, and email and image uploads
do not work. For the real launch use `deploy/DEPLOY.md`.

Check both providers' current free-tier terms before you start.

## What you need

- A Google Cloud account and a Neon account.
- Your own computer with this repository, Node 24 and `npm install` already run.
- About 45 minutes.

## 1. Neon: create the database

1. Create a Neon project. Pick a region on the same continent as the VM.
2. In the SQL editor run:

   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_trgm;
   ```

3. From the Connect dialog copy two connection strings:
   - **Direct** (no `-pooler` in the host). Used from your computer for migrations and the build.
   - **Pooled** (`-pooler` in the host). Used by the running app on the VM.

   Both must end with `?sslmode=require`.

## 2. Option A: Google Cloud, create the VM

1. Compute Engine, create an instance:
   - Machine type **e2-micro**, region us-west1, us-central1 or us-east1 (free-tier regions).
   - Boot disk Ubuntu 24.04 LTS, 30 GB standard.
   - Tick **Allow HTTP traffic** and **Allow HTTPS traffic**.
2. VPC network, IP addresses: promote the VM's external IP to **static** so it does not change.
3. Note the IP. Below it is written `203.0.113.7`. Use your own.

### A hostname with HTTPS is required

The site sends a `Content-Security-Policy` containing `upgrade-insecure-requests`
and Auth.js sets secure cookies. Over plain `http://<ip>` the browser rewrites
asset requests to https and the page breaks. So the demo needs HTTPS, but not
a real domain. Use a free wildcard DNS name that maps to your IP:

```
203-0-113-7.sslip.io        (dots in the IP become dashes)
```

Let's Encrypt issues certificates for it. When the university points
`maths.oauife.edu.ng` at the VM later, replace this name everywhere below.

## 3. Prepare the database from your computer

Run these in the repository, using the **direct** Neon string.

```bash
export DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"
export SEED_ADMIN_EMAIL="you@example.com"      # becomes the first SUPER_ADMIN

npx prisma migrate deploy
SEED_MODE=production npx prisma db seed
npm run db:import-legacy
```

`SEED_MODE=production` skips the `[SAMPLE]` settings. `db:import-legacy` then
fills the identity, HOD address, hero, contact, About/History pages and the
10 lecturer profiles from the old site. Both commands can be re-run safely.

## 4. Option A: build on your computer

Pages are prerendered during the build from the database, so the build must see
the imported content. Use your demo hostname for the two URLs.

```bash
export NEXT_PUBLIC_SITE_URL="https://203-0-113-7.sslip.io"
export AUTH_URL="https://203-0-113-7.sslip.io"
export AUTH_SECRET="$(openssl rand -base64 32)"   # keep this value, the VM needs the same one
export EMAIL_FROM="demo@example.com"
export RESEND_API_KEY="demo-not-used"
export CLOUDINARY_CLOUD_NAME="demo"
export CLOUDINARY_API_KEY="demo"
export CLOUDINARY_API_SECRET="demo"
export PRIVATE_STORAGE_DIR="/var/private-storage"

npm run build

cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
tar -czf maths-demo.tgz -C .next/standalone .
```

The Cloudinary and Resend values are dummies so the app starts. Image uploads
and emails (invites, password reset) will fail. That is expected for a demo.

## 5. Option A: set up the VM

SSH in (Compute Engine has an SSH button), then:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2

# 1 GB of RAM is tight; add swap
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

sudo mkdir -p /opt/maths-oau /var/private-storage
sudo chown -R $USER /opt/maths-oau /var/private-storage
```

## 6. Option A: upload and start the app

From your computer, upload the bundle (the SSH window's gear menu has Upload
file, or use `gcloud compute scp maths-demo.tgz VM_NAME:~`). On the VM:

```bash
tar -xzf ~/maths-demo.tgz -C /opt/maths-oau
cd /opt/maths-oau

# The bundle was built on another operating system. Install the Linux
# native modules for password hashing (required) and image processing.
npm install --no-save --force @node-rs/argon2-linux-x64-gnu@2.2.1
npm install --no-save --force @img/sharp-linux-x64@0.35.5 @img/sharp-libvips-linux-x64 || true
```

Create `/opt/maths-oau/.env` with these lines. Use the **pooled** Neon string and
the same `AUTH_SECRET` you used for the build:

```
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
AUTH_SECRET=<same value as the build>
AUTH_URL=https://203-0-113-7.sslip.io
NEXT_PUBLIC_SITE_URL=https://203-0-113-7.sslip.io
EMAIL_FROM=demo@example.com
RESEND_API_KEY=demo-not-used
CLOUDINARY_CLOUD_NAME=demo
CLOUDINARY_API_KEY=demo
CLOUDINARY_API_SECRET=demo
PRIVATE_STORAGE_DIR=/var/private-storage
```

Start it:

```bash
chmod 600 .env
set -a; . ./.env; set +a
pm2 start server.js --name maths-demo
pm2 save && pm2 startup     # run the command it prints, so it survives a reboot
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/   # expect 200
```

## 7. Option A: Nginx and HTTPS

```bash
sudo tee /etc/nginx/sites-available/maths-demo >/dev/null <<'EOF'
server {
    listen 80;
    server_name 203-0-113-7.sslip.io;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/maths-demo /etc/nginx/sites-enabled/maths-demo
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d 203-0-113-7.sslip.io --agree-tos -m you@example.com --redirect
```

`X-Forwarded-For $remote_addr` is deliberate: it stops visitors faking their IP
to get around the rate limiter (see `deploy/nginx/nginx-rate-limit-note.md`).

Open `https://203-0-113-7.sslip.io` in a browser.

## 8. Signing in as admin for the demo (both options)

The seed creates your `SEED_ADMIN_EMAIL` user without a password, and invite
and reset emails cannot send (dummy Resend key). Create a password once, from
your computer, with the direct Neon string still exported:

```bash
npx tsx scripts/set-admin-password.ts you@example.com 'choose-a-demo-password'
```

Use the same email as `SEED_ADMIN_EMAIL` and a password of at least 10 characters.
The script refuses to run with `NODE_ENV=production`, so run it in a shell where
that is not set. Delete or rotate this account after the demo.

## Option B: Render

Render builds on its own Linux machines and redeploys on every push to `main`,
so the VM, Nginx, swap and native-module steps are not needed. HTTPS comes with
the `*.onrender.com` address.

1. Do **step 1** (Neon) and **step 3** (migrate, seed, import) first, from your
   computer. In both Neon URLs delete `&channel_binding=require` and keep
   `sslmode=require`. The build reads the imported content, so this must come
   before the first deploy.
2. In Render: New, Blueprint, pick the `Ahavatech/math` repository. It reads
   `render.yaml` at the repo root and proposes one web service,
   `oau-maths-demo`.
3. When asked for the secret values, enter:
   - `DATABASE_URL`: the **pooled** Neon URL.
   - `AUTH_URL` and `NEXT_PUBLIC_SITE_URL`: `https://oau-maths-demo.onrender.com`.
     If that name is taken, Render adds a suffix. Read the real address on the
     service page, update both values, and press Manual Deploy, because
     `NEXT_PUBLIC_SITE_URL` is baked in at build time.
   - `AUTH_SECRET` is generated for you.
4. Wait for the build. The free plan has 512 MB of memory. If the build stops
   with an out-of-memory error, change the plan to Starter (about $7 a month)
   for the demo, then switch back.
5. Do **step 8** to create the admin password, then open the site.

What to expect on the free plan:

- The service sleeps after about 15 minutes idle and the first request then
  takes 30 to 60 seconds. Open the site a couple of minutes before the demo.
- Uploaded files vanish on every restart or deploy (no persistent disk).
- Updates: push to `main` and Render redeploys. Content changes made in
  `/admin` live in Neon and are not affected.
- To stop it, suspend or delete the service in the Render dashboard.

## What the HOD will see, and what is missing

Works: the full public site, lecturer profiles, programmes, research areas,
news, events, search, the admin area, the journal pages.

Not working in the demo: photos (staff show initials; uploads need Cloudinary),
emails of every kind, alumni records (none imported, by design), the daily
cleanup and reminder jobs, and backups.

## Updating the demo

On Render, push to `main`. On the VM: change the content in `/admin`, or rebuild on your computer (step 4), upload a
new `maths-demo.tgz`, re-run the two `npm install` lines, then
`pm2 restart maths-demo`. Re-run step 3 first only if the database changed.

## Taking it down

Stop the VM (or delete it) and delete the Neon project. Both stop billing and
the data is gone.
