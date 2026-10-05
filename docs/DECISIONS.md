# DECISIONS.md

Decisions below are settled. Do not reopen them without asking. Add new decisions at the bottom with a date.

| # | Date | Decision |
|---|---|---|
| 1 | 2026-10-05 | Build with Next.js (App Router, TypeScript, Tailwind, shadcn/ui). |
| 2 | 2026-10-05 | Database is PostgreSQL, accessed with Prisma. |
| 3 | 2026-10-05 | Authentication is Auth.js with roles and invite links. The admin creates each lecturer profile, and the lecturer receives an invite link to set their own password. |
| 4 | 2026-10-05 | Images are compressed and stored in Cloudinary. Public PDFs (published articles, handbook, forms, CVs) go to Cloudinary too, with PDF delivery enabled in its security settings. |
| 5 | 2026-10-05 | Manuscripts under review and reviewer reports are private. They are stored on the backend server disk and served only through an authorised route. |
| 6 | 2026-10-05 | Email is sent through Resend. The department domain needs SPF and DKIM records to verify the sender. |
| 7 | 2026-10-05 | The university provides frontend hosting only. The backend runs on a KVM 1 VPS bought for the project. |
| 8 | 2026-10-05 | The journal lives at /journal inside the same app, with author submission and peer review in the first release. OJS is not used. |
| 9 | 2026-10-05 | Alumni all fill the form again. The 519 recorded graduates are not seeded publicly. They may be kept as a private cross-check list in the admin. |
| 10 | 2026-10-05 | Everything dynamic is editable through the admin, including the HOD welcome address and picture. |
| 11 | 2026-10-05 | No em dashes in UI copy, emails or docs. |

## Open questions
- Does the university frontend hosting run Node.js? If not, the whole Next.js app runs on the KVM 1 and the university host only handles the domain or a redirect.
- Where does PostgreSQL run (same VPS or a managed provider)?
- Who obtains the Crossref membership if DOIs are wanted?
- Statistics split: remove Statistics content or cross-link it?
- Pricing and payment terms.
