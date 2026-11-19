# Handover: running the department website

For the web administrator and the head of department. Everything here is already built and tested; this page says how to look after it.

## Who can do what

| Role | What they manage |
| --- | --- |
| Super Admin | Everything, including users, roles and two-factor resets |
| HOD | Site content, menus, pages, media, academics, lecturers, news, events, alumni, journal oversight |
| Admin | Academics, lecturers, news, events, alumni, messages, student resources |
| Lecturer | Their own public profile only |
| Journal editors, reviewers, authors | The journal screens meant for them |

Staff accounts are created by invitation (Admin > Users > Invite user). The invited person chooses their own password from the emailed link.

## Signing in safely

- **Administrators** (Super Admin, HOD, Admin) must turn on **two-factor sign-in** the first time they open the admin area: install an authenticator app (Google Authenticator, Microsoft Authenticator, Authy), scan the picture, enter the code, and **save the eight recovery codes** somewhere safe (a password manager or a printed copy). Each code works once.
- Anyone can add a **passkey** (fingerprint, face or device PIN) at `/two-factor` and then sign in with one button. A passkey only works on the exact web address it was made on.
- Sessions last 12 hours. **Sign out on all devices** is on the account page (Admin > My profile > Change password).
- New passwords must be 10 to 128 characters, not very common, not made from the person's name or email, and not found in public data breaches.
- If someone enters a wrong password for your account several times you are emailed once an hour. If you get one you did not expect, change your password.

### If someone loses their phone
1. They use one of their **recovery codes** in the sign-in box instead of the six digits.
2. If they have no recovery codes, a **Super Admin** opens Admin > Users and presses **Reset two-factor** next to their name. They set it up again at their next sign-in.
3. If the **only** Super Admin is locked out: on the server set `ADMIN_2FA_REQUIRED=false` in `/etc/oaumaths/env`, restart the service (`systemctl restart oaumaths`), sign in, reset the account, then set it back to `true` and restart.

## Everyday tasks

| Task | Where |
| --- | --- |
| Write or edit news and events | Admin > News / Events (use the quick actions on the dashboard) |
| Change the homepage, About photograph, contact details, announcement bar | Admin > Site content |
| Edit the menu | Admin > Navigation |
| Edit page text (About, Privacy, Students intro, journal pages) | Admin > Pages |
| Publish or hide a lecturer | Admin > Lecturers (the **More** menu on each row) |
| Approve alumni entries | Admin > Alumni |
| Read contact messages | Admin > Messages |
| Appearance (light, dark, or follow the device) | The Appearance control in the footer or admin sidebar |

Guides for lecturers, journal editors, reviewers and authors are in this folder (`LECTURER-GUIDE.md`, `JOURNAL-*.md`, `CONTENT-EDITING.md`).

## Looking after the server

Everything below is on the VPS. Details are in `deploy/shared-vps/DEPLOY-SHARED.md`.

- **Update to a new version:** back up the database, then `sudo -u maths bash /opt/oaumaths/repo/deploy/shared-vps/update.sh`. It pulls, installs, migrates, builds, restarts and checks health. Finish by checking `systemctl status oaumaths`.
- **Backups:** a daily backup job keeps 14 days (`deploy/backup-scripts`). Test a restore at least once a term.
- **Logs:** `journalctl -u oaumaths -n 100` for the app; `/var/log/oaumaths/` for Nginx and job logs, rotated weekly and kept eight weeks.
- **Health check:** `https://<your site>/api/health` answers `{"status":"ok"}`.
- **Security updates:** run `npm audit --omit=dev` in the repository now and then and ask the developer to apply fixes; update the server's operating system regularly.
- **Settings that matter in `/etc/oaumaths/env`:** `AUTH_URL` (the exact public address; changing it invalidates passkeys), `AUTH_SECRET` (keep it secret; changing it signs everyone out and makes every stored two-factor secret unreadable, so everyone would have to set two-factor up again), email and image-service keys.

## What has and has not been checked

Checked by automated tests and reviews: accessibility, phone and desktop layout, light and dark mode, every role's access to every admin area, sign-in and session behaviour, forms, the journal flows, and known dependency vulnerabilities.

Not done: a penetration test by an independent person against the live server, testing on a range of real phones, and a screen-reader review. Treat those as the next step if the department needs assurance beyond this.
