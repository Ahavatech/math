# A Living Website for OAU Mathematics: Project Scope and Brief

Last updated: 2026-10-05

## Project overview

The Department of Mathematics, Obafemi Awolowo University, is replacing its static website (maths.oauife.edu.ng) with a Next.js platform that the HOD and staff can run themselves, without a developer.

**Prepared for:** Prof. B. S. Ogundare, Head of Department.

**Why now:** the HOD finds the current site too static and wants it to be more relatable to students, staff, alumni and visitors.

**What the HOD asked for**

- A personal portfolio page for every lecturer at /lecturer/name. The admin creates each profile, then the lecturer receives login access to complete their own page.
- A departmental journal at /journal, with online manuscript submission and peer review.
- An alumni section. The admin sends out a form link, alumni fill in where they are now, and the admin verifies each entry before it appears on the site.
- A proper events section with upcoming and past events.
- Full admin control: everything dynamic on the site, including the HOD's picture and welcome address, is edited through the admin area.

**Goals**

1. Make the site feel alive, with fresh news, events, lecturer work and alumni stories on the homepage.
2. Give the department one place to publish research and journal articles.
3. Build a verified, growing alumni directory.
4. Remove the need for a developer for day-to-day content changes.
5. Serve students with the department handbook, course catalogue and downloads online.

**How we will know it worked**

| Measure | Target at handover |
| --- | --- |
| Editable content | Every dynamic section can be changed from the admin area with no code |
| Lecturer onboarding | Every lecturer the department names has an active account and a live portfolio page |
| Alumni flow | A submitted alumni form reaches the pending queue, and only approved entries appear publicly |
| Journal | A manuscript can move from submission through peer review to a published article |
| Events | Upcoming and past events split automatically by date |
| Speed | Public pages load quickly on a slow mobile connection |

## What the site has today

The current site is a single long page with fixed content, so nothing can change without a developer editing the code.

| Area | What exists now |
| --- | --- |
| Navigation | About, Programmes, Research, News, Staffs, Alumni, Contact |
| Homepage | Hero with a formula ticker, stats strip, scrolling announcement bar, HOD welcome message |
| Programmes | B.Sc. Mathematics (4 years), M.Sc. Mathematics (1.5 to 2 years, 10 listed specialisations), Ph.D. Mathematics (3 to 5 years) |
| Research | 9 area cards: Algebra and Number Theory, Analysis, Differential Equations, Fluid Mechanics, Numerical Analysis, Graph Theory and Combinatorics, Topology and Geometry, Mathematical Biology, Solid Mechanics |
| Staff | 8 academic cards and 5 non-teaching cards. Each opens a modal with Biography, Contact, Hobbies and Interests, Selected Publications |
| News and events | Flyers you click to zoom. News and events share one section |
| Alumni | A static page describing 519 recorded graduates from 1965 to 2008 |
| Contact | Address, phone, office hours and an enquiry form with type selector |

**Problems to fix**

- The stats disagree with the content. The hero says 1,200+ alumni and 30+ academic staff, while the alumni section records 519 graduates and the staff section shows 8 academic staff.
- Statistics became a separate department in January 2025, so programmes, staff counts and research areas need review.
- There is no archive of past events and no separate events section.
- Lecturers cannot update their own profiles, and there is no handbook, course list or downloads area.
- The alumni page is informational only. It cannot collect or show alumni updates.

**Ideas adopted from other departments**

- MIT keeps a calendar, a seminars listing, a conferences list and a newsletter as separate pieces of its news and events area. We adopt the calendar and seminar series pattern.
- UC San Diego gives each research area its own page and has advising, planned course offerings, scholarships and careers pages. We adopt per-area research pages and a students section.
- Student handbooks from other universities are PDFs. We publish the OAU handbook as searchable web pages as well as a PDF download.

## Scope of work

The build has eight modules. Every module is managed from the admin area and nothing is hard-coded.

### A. Public website

- Homepage with live news, upcoming events, a featured lecturer, featured alumni and real stats pulled from the database
- About page with history, mission, vision, the HOD welcome address and a note on the Statistics split
- Programme pages for B.Sc., M.Sc. and Ph.D., each with specialisations and admission requirements
- One page per research area, linking to the lecturers, publications and students working in it
- Contact page with an enquiry form that routes by type (Admissions, Research, Collaboration, Alumni, General), a map and office hours
- Global search, and a mobile-first layout that stays fast on slow connections

### B. Lecturer portfolios

- Each lecturer gets a page at /lecturer/[slug]. The slug is generated from the name, with duplicates handled.
- Page content: photo, rank, biography, research interests, courses taught, publications, Google Scholar, ORCID and ResearchGate links, office hours, downloadable CV, supervised students
- The admin creates the profile first (name, rank, official email). The lecturer then receives an invite link to set their own password, and completes the page.
- Lecturers can edit only their own page. The admin can hide, restore or override any page.
- A staff directory at /staff with search and filters by rank and research area
- Non-teaching staff appear as simple listing cards with no login. Emeriti and former staff have their own section.

### C. Departmental journal at /journal, with submission and peer review

The journal is built inside the same Next.js app, with its own workflow and roles.

**Public side**

- /journal landing page with aims and scope, editorial board (pulled from lecturer profiles), author guidelines, call for papers, ISSN and licence details
- /journal/issues with a volume and issue archive
- /journal/articles/[slug] with abstract, authors, keywords, PDF download and a how-to-cite box
- Google Scholar indexing metadata on every article page

**Submission and review workflow**

1. An author registers and submits a manuscript with metadata, co-authors and a file upload.
2. The editor screens the submission and either desk-rejects it or assigns reviewers.
3. Reviewers accept or decline, then submit reports and a recommendation.
4. The editor reads the reports and decides: accept, minor revision, major revision or reject.
5. The author uploads a revised version and responds to comments, and the loop repeats if needed.
6. Accepted papers are copyedited, assigned to an issue and published.

Every step sends an email notification. The system keeps a full history for each manuscript, and reviewer identities stay hidden from authors (blind review). Roles are Editor-in-Chief, Editor, Reviewer and Author.

**Known limits**

- DOI registration needs a Crossref membership, which the department must obtain separately.
- Plagiarism checks and automated indexing feeds (OAI-PMH) are not in the first release. They can be added later.

### D. Alumni

- Alumni fill in the form again. The 519 recorded graduates are not seeded into the public directory.
- The admin generates a form link, either one general link or per-cohort links, and sends it out.
- Form fields: name, level (B.Sc. or M.Sc.), graduation year, current organisation, role, location, photo, LinkedIn (optional), consent checkbox
- Submissions go to a Pending queue. The admin approves or rejects, and only approved entries show publicly.
- The old 519-name list can be kept private in the admin as a cross-check for the approver. It never appears publicly.
- Duplicate detection on name and graduation year, plus spam protection on the form
- Public directory filterable by year, level, country and industry, with a Where are they now spotlight
- The alumni count on the homepage is a live count of approved entries

### E. Events

- Admin creates events with title, type (seminar, colloquium, special lecture, conference, graduation), date and time, venue, speaker, flyer, description and registration link
- Upcoming and Past tabs split automatically by date
- Past events carry a photo gallery, slides and recording links
- Add-to-calendar (.ics) and recurring seminar series
- The existing click-to-zoom flyer viewer is kept

### F. News and announcements

- Separate from events, with categories such as announcement, achievement, admission and research
- Rich-text editor, pinned posts and drafts
- An email newsletter sign-up can follow later

### G. Student resources

- The department handbook as searchable web pages, plus the original PDF for download
- A course catalogue with code, title, units, level, semester, prerequisites and lecturer
- Academic calendar, forms and downloads
- Later: course materials uploaded by lecturers and a timetable

### H. Site content management

The HOD and admins edit all of this without code. See the next section for who can do what.

- HOD welcome address, name, title and photo
- Homepage hero text and image, announcement banner and stats
- About and history text, mission and vision
- Programmes, research areas, specialisations and admission requirements
- Contact details, office hours, address, social links, footer and menu items

## Roles and admin control

Every editable part of the site is behind a login, and each role sees only what it needs.

| Role | Can do |
| --- | --- |
| Super admin | Everything, including users, roles and site settings |
| HOD | Edit all site content and settings, including news and events, approve alumni, manage lecturers |
| Department admin | Manage news, events, lecturers, alumni approvals, handbook and downloads |
| Lecturer | Edit their own portfolio and upload their own course materials only |
| Journal Editor-in-Chief and Editor | Screen submissions, assign reviewers, decide, and publish issues |
| Journal Reviewer | See and review only the manuscripts assigned to them |
| Journal Author | Submit and track their own manuscripts |
| Alumni | No login. They use a one-time form link |
| Public | Read-only access |

**Admin features that keep the site safe**

- Rich-text editor and image upload with crop and resize
- Draft, preview and publish for every content type
- Version history, so a bad edit can be rolled back
- Activity log showing who changed what and when
- Invite links for new accounts instead of emailed passwords
- Password reset, and the ability to deactivate an account when someone leaves

## Technical architecture

The site is one Next.js application with a PostgreSQL database, role-based access and a shared admin area, so the journal, lecturer accounts and content editing all live in the same system.

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router) with TypeScript |
| Styling | Tailwind CSS and shadcn/ui |
| Database | PostgreSQL with Prisma ORM |
| Authentication | Auth.js, with roles and invite links |
| File storage | Cloudinary for compressed images and public PDFs. Manuscripts under review are stored privately on the backend server |
| Email | Resend, for invites, alumni links and journal notifications |
| Rich text | Tiptap editor for news, bios and page content |
| Search | PostgreSQL full-text search to start |
| Hosting | Frontend on the university's hosting. Backend on a KVM 1 VPS bought for the project |
| Rendering | Static or incremental rendering for public pages, so they load fast on weak networks |

**Security and compliance**

- Rate limiting and spam protection on all public forms
- Automatic database backups
- File type and size checks on every upload, and private storage for manuscripts under review
- An alumni consent checkbox and privacy notice aligned with the Nigeria Data Protection Act

**Sitemap**

```
/                          Home
/about                     About, HOD address, history
/programmes/[level]        B.Sc., M.Sc., Ph.D.
/research/[area]           Research area pages
/staff                     Directory
/lecturer/[slug]           Lecturer portfolios
/news, /news/[slug]        News
/events, /events/[slug]    Upcoming and Past tabs
/alumni                    Directory and spotlight
/alumni/submit/[token]     Alumni form link
/students                  Handbook, courses, calendar, downloads
/journal                   Landing page
/journal/issues            Volume and issue archive
/journal/articles/[slug]   Published article
/journal/submit            Author submission
/journal/dashboard         Author, reviewer and editor workspace
/contact                   Contact and enquiry form
/login, /admin             Sign in and admin area
```

**Main data records**

| Record | Key fields |
| --- | --- |
| User | name, email, role, active status |
| Lecturer profile | user, slug, rank, bio, research areas, courses, links, photo, CV |
| Research area | title, description, order, visibility |
| News post | title, category, body, image, status, publish date |
| Event | title, type, start and end, venue, speaker, flyer, gallery, status |
| Alumni entry | name, level, year, organisation, role, location, photo, consent, status (pending, approved, rejected) |
| Alumni link | token, cohort, expiry, use count |
| Course | code, title, units, level, semester, prerequisites, lecturer |
| Manuscript | title, abstract, authors, files, status, current round |
| Review | manuscript, reviewer, report, recommendation, dates |
| Issue and article | volume, number, year, articles, PDF, keywords |
| Site setting | key and value pairs for the HOD address, hero, stats and contacts |
| Audit log | who, what changed, when |

## Phases, assumptions and what we need

The build runs in six phases, with the journal as the largest one. Durations are indicative and will be confirmed once the handbook and first content arrive.

1. **Foundation (about 3 weeks).** Design system, homepage, about, programmes, research, contact, news, events and the admin area with site content management.
2. **Accounts and portfolios (about 3 weeks).** Authentication, roles, lecturer invites, /lecturer/[slug] pages and the staff directory.
3. **Alumni (about 2 weeks).** Form links, pending queue, approval flow, public directory and spotlight.
4. **Students and handbook (about 2 weeks).** Handbook pages, course catalogue, academic calendar and downloads.
5. **Journal (about 5 weeks).** Public journal pages, author submission, reviewer and editor workflow, notifications, issues and article publishing.
6. **Polish and handover (about 2 weeks).** Search, SEO, performance tuning, testing, content entry support, training for the HOD and admins, and documentation.

**Deliverables**

- The complete Next.js application, deployed and running on the department's domain
- The admin area with all roles configured
- Seed content loaded from the current site and the handbook
- Training session for the HOD and admins, plus a short written guide
- Source code and hosting handover

**Assumptions**

- The department supplies the handbook, staff list, correct statistics and any images it wants used.
- The department names one person to approve alumni entries and manage content after launch.
- The department provides the domain, DNS access and the frontend hosting. The backend runs on a KVM 1 VPS bought for the project.
- Lecturers complete their own portfolio content. We do not write biographies.

**Not included in the first release**

- DOI registration and Crossref membership
- Plagiarism checking and automated indexing feeds for the journal
- Course material uploads by lecturers and the student timetable (planned as follow-ups)
- Online payments, student results or any portal tied to university records
- Ongoing hosting costs and content writing

**Risks**

| Risk | How we handle it |
| --- | --- |
| The journal workflow is the largest piece and can grow in scope | Freeze the workflow above at kickoff. Extra features go to a later release |
| Lecturers are slow to complete their portfolios | Launch with core fields only, and let the admin nominate staff who help enter content |
| Alumni submissions are inconsistent or spam | Approval queue, duplicate checks and spam protection, plus the private cross-check list |
| Email invites land in spam folders | Use a verified sender domain and show the admin who has not yet accepted their invite |
| Content and statistics stay inconsistent | Live counts from the database replace hard-coded numbers |

**What we need from the department**

- The department handbook and current course list
- Correct staff, alumni and student numbers
- The list of lecturers to onboard first, with ranks and official emails
- A decision on whether Statistics content is removed or cross-linked
- The private list of 519 recorded graduates for the approver's cross-check, if the department agrees to share it
- Journal details: editor-in-chief, editorial board, ISSN, scope and author guidelines
- Domain and DNS access (to verify the Resend sender), details of the frontend hosting including whether it runs Node.js, and the university IT contact
