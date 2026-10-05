Read CLAUDE.md, docs/SCOPE.md, docs/DECISIONS.md, docs/ROADMAP.md, PRODUCT.md and the last entry of AUDIT.md. This is Stage 02. Save this exact prompt as docs/prompts/02-database.md.

PRE-CHECK
- Stage 01 must be merged into main. If it is not, stop and tell me.
- If docs/SCOPE.md is missing, stop and tell me.
- Then create branch stage/02-database from main.

PROCESS
Use Superpowers writing-plans, then test-driven development where it applies. Skip brainstorming, the models are specified below. If you disagree with a modelling choice, do not silently change it. Record it under Deviations in AUDIT.md and tell me.

GOAL
Prisma schema for every module in SCOPE.md, the first migration, a seed, tests, and a data model doc. No UI. No auth logic. No Cloudinary or Resend code.

GENERAL RULES
- PostgreSQL, cuid ids, createdAt and updatedAt on every mutable model.
- Enums for fixed sets. Unique slugs on every public entity. Indexes on status, publishedAt, startsAt, graduationYear and other filter fields.
- onDelete: Cascade for rows owned by a parent, SetNull for optional author links, Restrict where deleting would lose accountability (AuditLog actors, decisions).
- Tokens are stored hashed only. There must be no plaintext token column anywhere.
- Images are referenced through a nullable relation to MediaAsset, not raw URL strings.
- Private manuscript files are referenced by storageKey (a path inside PRIVATE_STORAGE_DIR), never by URL.
- Use ContentStatus (DRAFT, PUBLISHED, ARCHIVED) for anything the public sees. Use ARCHIVED instead of hard deletes for content.

MODELS

Users and access
- User: email (unique), name, passwordHash (nullable until invite accepted), isActive, lastLoginAt.
- UserRole: userId, role. Unique on the pair. A user can hold several roles. Role enum: SUPER_ADMIN, HOD, ADMIN, LECTURER, JOURNAL_EDITOR_IN_CHIEF, JOURNAL_EDITOR, REVIEWER, AUTHOR.
- UserToken: userId, type (INVITE, PASSWORD_RESET), tokenHash (unique), expiresAt, usedAt.
- No Auth.js Account, Session or VerificationToken tables. We will use the Credentials provider with JWT sessions. Record this in DECISIONS.md.

Site content
- SiteSetting: key (primary key), value (Json), updatedById. This holds the HOD name, title, photo and welcome address, hero text and image, stat overrides, contact details, social links and footer text.
- NavItem: label, href, parentId (self), location (HEADER, FOOTER), order, isVisible.
- Page: slug, title, body (rich text), status. Used for About, History, Mission and similar.
- MediaAsset: provider, publicId, url, width, height, bytes, format, alt, uploadedById.
- ContentRevision: entityType, entityId, snapshot (Json), createdById. This provides version history.
- AuditLog: actorId (nullable), action, entityType, entityId, summary, diff (Json), ip, userAgent. Index on entity and createdAt.
- ContactMessage: name, email, type (ADMISSIONS, RESEARCH, COLLABORATION, ALUMNI, GENERAL), subject, message, status (NEW, READ, REPLIED, ARCHIVED).

Academics
- Programme: slug, level (BSC, MSC, PHD), title, summary, body, duration, admissionRequirements, order, status.
- Specialisation: programmeId, title, description, order.
- ResearchArea: slug, title, summary, body, imageId, order, status.
- Course: code (unique), title, units, level (Int), semester (FIRST, SECOND), description, status. Many-to-many with itself for prerequisites (CoursePrerequisite). Many-to-many with LecturerProfile (CourseLecturer).
- HandbookPage: slug, title, body, parentId (self), order, status.
- Download: title, description, category, mediaId or fileUrl and publicId, fileSize, order, status.
- AcademicCalendarEntry: session label, title, startDate, endDate, description.

People
- LecturerProfile: userId (unique), slug (unique), fullName, honorific, rank (enum: PROFESSOR, ASSOCIATE_PROFESSOR, SENIOR_LECTURER, LECTURER_I, LECTURER_II, ASSISTANT_LECTURER, GRADUATE_ASSISTANT, OTHER), photoId, bio, officeLocation, officeHours, publicEmail, phone, scholarUrl, orcid, researchGateUrl, linkedinUrl, cvDownloadId, isEmeritus, order, status. Many-to-many with ResearchArea.
- Publication: lecturerId, title, authorsText, venue, year, url, doi, order.
- NonTeachingStaff: name, position, photoId, email, phone, order, isActive.

News and events
- NewsPost: slug, title, category (ANNOUNCEMENT, ACHIEVEMENT, ADMISSION, RESEARCH), excerpt, body, coverId, isPinned, status, publishedAt, authorId.
- EventSeries: slug, title, description.
- Event: slug, title, type (SEMINAR, COLLOQUIUM, SPECIAL_LECTURE, CONFERENCE, GRADUATION, OTHER), startsAt, endsAt, venue, speakerName, speakerAffiliation, description, flyerId, registrationUrl, slidesUrl, recordingUrl, seriesId, status.
- EventGalleryImage: eventId, mediaId, caption, order.

Alumni
- AlumniLink: tokenHash (unique), label, cohortYear (nullable), expiresAt, maxUses (nullable), useCount, isActive, createdById.
- AlumniEntry: fullName, email, level (BSC, MSC), graduationYear, organisation, roleTitle, city, country, industry, photoId, linkedinUrl, consentAt, consentVersion, status (PENDING, APPROVED, REJECTED), rejectionReason, reviewedById, reviewedAt, linkId, dedupeKey (normalised name plus year, indexed, NOT unique), isFeatured.
- AlumniReferenceRecord: fullName, level, graduationYear, note. This is the private cross-check list from the old 519 names. Admin only, never public.

Journal
- JournalIssue: volume, number, year, title, coverId, publishedAt, status. Unique on volume and number.
- Article: slug, title, abstract, keywords (String[]), issueId, pageStart, pageEnd, pdfDownloadId, doi, license, publishedAt, status, manuscriptId (unique, nullable).
- ArticleAuthor: articleId, name, affiliation, email, order, userId (nullable).
- EditorialBoardMember: lecturerProfileId (nullable), name, roleTitle, affiliation, order, isActive.
- Manuscript: title, abstract, keywords (String[]), status (SUBMITTED, SCREENING, UNDER_REVIEW, REVISION_REQUESTED, ACCEPTED, REJECTED, WITHDRAWN, PUBLISHED), submittedById, handlingEditorId, currentRound.
- ManuscriptAuthor: manuscriptId, name, affiliation, email, isCorresponding, order.
- ManuscriptRound: manuscriptId, number, submittedAt. Unique on manuscript and number.
- ManuscriptFile: manuscriptId, roundId, kind (MANUSCRIPT, SUPPLEMENTARY, RESPONSE_TO_REVIEWERS, REVISED, COPYEDITED), originalName, storageKey, mimeType, size, sha256, uploadedById.
- ReviewAssignment: manuscriptId, roundId, reviewerId, status (INVITED, ACCEPTED, DECLINED, SUBMITTED, EXPIRED), invitedAt, respondedAt, dueAt. Unique on manuscript, round and reviewer.
- Review: assignmentId (unique), recommendation (ACCEPT, MINOR_REVISION, MAJOR_REVISION, REJECT), commentsToAuthor, commentsToEditor, submittedAt.
- EditorialDecision: manuscriptId, roundId, editorId, decision (ACCEPT, MINOR_REVISION, MAJOR_REVISION, REJECT, DESK_REJECT), letter.

SEED (idempotent, safe to run twice)
- Real data only where it comes from the current site: the nine research areas, the three programmes with their levels and durations (B.Sc. 4 years, M.Sc. 1.5 to 2 years, Ph.D. 3 to 5 years), and the header and footer navigation. Do not invent M.Sc. specialisations. That stage will fetch them from the live site.
- Default SiteSetting keys with clearly marked placeholder text.
- One SUPER_ADMIN user with email from SEED_ADMIN_EMAIL and no password. Stage 03 adds the invite flow that sets it.
- Any sample record starts with "[SAMPLE]" so it is easy to find and delete. Real records never carry that prefix.

TESTS (Vitest, against a separate test database)
- Add TEST_DATABASE_URL to .env.example and env.ts. Add a test setup that applies migrations to it.
- Cover: seed runs twice without duplicates; UserRole pair uniqueness; slug uniqueness; ReviewAssignment uniqueness; one Review per assignment; token columns are hashes only (no plaintext column exists); cascade and restrict behaviour on two or three representative relations.

DOCS
- docs/DATA-MODEL.md: a Mermaid ER diagram split by module, a short note per model, and a "public-safe fields" list that says which fields may ever be selected in public queries. For example, AlumniEntry.email and all manuscript and review data are never public.
- Add the new decisions to docs/DECISIONS.md (multiple roles per user, Credentials with JWT sessions, MediaAsset relation, ARCHIVED instead of delete).

VERIFY AND REPORT
- Start local Postgres, run prisma validate, generate, migrate, then seed twice. Run lint, typecheck, test and build. All must pass.
- Commit as conventional commits on stage/02-database. Do not push.
- Append Entry 002 to AUDIT.md using the template. Tick Stage 02 in docs/ROADMAP.md.
- Finish with a short summary: models created (count), commands run with results, deviations, anything I must do by hand.
