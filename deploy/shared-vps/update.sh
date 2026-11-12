#!/usr/bin/env bash
#
# Rebuild and redeploy the OAU Mathematics site on the shared VPS.
# Run as the maths user:
#   sudo -u maths bash /opt/oaumaths/repo/deploy/shared-vps/update.sh
#
# The build happens in /opt/oaumaths/repo. The finished standalone output is
# copied to /opt/oaumaths/app, which is what the service runs, so the live
# site keeps serving while the build runs.

set -euo pipefail

export PATH=/opt/node24/bin:$PATH
REPO=/opt/oaumaths/repo
APP=/opt/oaumaths/app

cd "$REPO"
git pull --ff-only

# Load the same environment the service uses (the build validates it and
# prerenders pages from the database).
set -a
. /etc/oaumaths/env
set +a

# Keep the build within the memory the box can spare.
export NODE_OPTIONS=--max-old-space-size=2048

nice -n 10 npm ci --include=dev
npx prisma migrate deploy
nice -n 10 npm run build

mkdir -p "$APP"
rsync -a --delete .next/standalone/ "$APP/"
mkdir -p "$APP/.next/static" "$APP/public"
cp -r .next/static/. "$APP/.next/static/"
cp -r public/. "$APP/public/"

sudo systemctl restart oaumaths
sleep 4
curl -fsS http://127.0.0.1:3100/api/health
echo
echo "Deployed."
