# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two groups:
- **Internal managers**: the HOD (Prof. B. S. Ogundare) and department staff/admins who run almost everything from an admin area with no developer involved day to day. Lecturers manage their own portfolio profile only.
- **Public visitors**: prospective and current students (programmes, courses, handbook, admissions info), academic peers and journal authors/reviewers (submitting to or reading the journal), alumni (reconnecting, filling the alumni form), and the general public/press (news, events, department reputation).

## Product Purpose

Replace maths.oauife.edu.ng, the public website of the Department of Mathematics, Obafemi Awolowo University, Ile-Ife, with a self-service platform. Success means the HOD and staff can update nearly all content (welcome address, staff, programmes, news, events, alumni, student resources) without a developer, while the department also gains a working in-house academic journal with submission and peer review.

## Positioning

A department website that is also a self-managed CMS and a self-hosted journal platform (not OJS) in one system, so the department does not depend on external journal software or on a developer for routine content changes.

## Operating Context

- The HOD and admins log into /admin to manage site content: homepage hero, welcome address, stats, contacts, programmes, research areas, menus, and footer.
- Admins create lecturer profiles and send invite links; lecturers set their own password and then edit only their own profile.
- Authors submit manuscripts through /journal; editors and reviewers run peer review rounds; reviewer identity stays hidden from authors.
- Alumni reach a public form via shared links; submissions sit in a pending queue until admin approval before appearing publicly.
- Visitors on slow mobile connections browse public pages (about, programmes, staff, lecturer profiles, news, events, alumni directory, student resources, journal).

## Capabilities and Constraints

- Nothing dynamic is hard-coded: HOD welcome address and photo, hero text/image, stats, contacts, programmes, research areas, menu and footer are all admin-editable.
- Manuscripts under review and reviewer reports are private, stored on the backend server disk outside the web root, served only through an authorised route.
- Alumni entries are never public until approved; the 519 previously recorded graduates are not seeded publicly and may exist only as a private admin cross-check list.
- University provides frontend hosting only; the backend runs on a KVM 1 VPS. Final hosting topology (whether the university host runs Node.js, where PostgreSQL runs) is still open - see docs/DECISIONS.md open questions.
- No em dashes anywhere in UI copy, emails, or docs.
- No department facts (staff, statistics, dates, names) may be invented. Until real assets are supplied, the build uses clearly marked sample data that is easy to remove later.
- Pricing/payment terms, Crossref/DOI membership, and the Statistics-content split are explicitly undecided (see docs/DECISIONS.md open questions).

## Evidence on Hand

No real department assets are available yet (no logo, HOD photo, or verified statistics/history). The build proceeds with clearly marked sample/placeholder data per CLAUDE.md rules; real assets will be swapped in later through the admin.

## Product Principles

- Content lives in the database and is editable in /admin; nothing a non-developer would need to change is hard-coded.
- Authorisation is checked on the server for every mutation and every private read; hiding a UI control is never treated as security.
- Never invent department facts; sample data is clearly marked and disposable.
- Build for slow mobile connections: static/ISR where possible, compressed images, light client bundles.
- Journal review integrity: reviewer identity hidden from authors, manuscripts and reports private by default.

## Accessibility & Inclusion

WCAG 2.1 AA is required by the university. Combined with the slow-mobile-connection constraint above, this governs both the visual and performance bar for every public and admin surface.
