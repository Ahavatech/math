-- Site search: add tsvector columns and GIN indexes for full-text search
-- Covers: NewsPost, Event, LecturerProfile, NonTeachingStaff, Programme,
--         ResearchArea, Course (already has searchText), HandbookPage (already has searchText),
--         Download, AcademicCalendarEntry, JournalIssue, Article (already has searchText)

-- Enable pg_trgm for trigram/prefix matching on names and codes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- NewsPost: tsvector on title + excerpt + body
ALTER TABLE "NewsPost" ADD COLUMN IF NOT EXISTS "searchVec" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("excerpt", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("body", '')), 'C')
    ) STORED;
CREATE INDEX IF NOT EXISTS "NewsPost_searchVec_idx" ON "NewsPost" USING GIN ("searchVec");

-- Event: tsvector on title + description
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "searchVec" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("description", '')), 'B')
    ) STORED;
CREATE INDEX IF NOT EXISTS "Event_searchVec_idx" ON "Event" USING GIN ("searchVec");

-- LecturerProfile: tsvector on fullName (A) + bio (B)
ALTER TABLE "LecturerProfile" ADD COLUMN IF NOT EXISTS "searchVec" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("fullName", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("bio", '')), 'B')
    ) STORED;
CREATE INDEX IF NOT EXISTS "LecturerProfile_searchVec_idx" ON "LecturerProfile" USING GIN ("searchVec");
-- Trigram index for prefix/partial name matching
CREATE INDEX IF NOT EXISTS "LecturerProfile_fullName_trgm_idx" ON "LecturerProfile" USING GIN ("fullName" gin_trgm_ops);

-- NonTeachingStaff: tsvector on name + position
ALTER TABLE "NonTeachingStaff" ADD COLUMN IF NOT EXISTS "searchVec" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("position", '')), 'B')
    ) STORED;
CREATE INDEX IF NOT EXISTS "NonTeachingStaff_searchVec_idx" ON "NonTeachingStaff" USING GIN ("searchVec");
CREATE INDEX IF NOT EXISTS "NonTeachingStaff_name_trgm_idx" ON "NonTeachingStaff" USING GIN ("name" gin_trgm_ops);

-- Programme: tsvector on title + summary + body
ALTER TABLE "Programme" ADD COLUMN IF NOT EXISTS "searchVec" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("summary", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("body", '')), 'C')
    ) STORED;
CREATE INDEX IF NOT EXISTS "Programme_searchVec_idx" ON "Programme" USING GIN ("searchVec");

-- ResearchArea: tsvector on title + summary + body
ALTER TABLE "ResearchArea" ADD COLUMN IF NOT EXISTS "searchVec" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("summary", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("body", '')), 'C')
    ) STORED;
CREATE INDEX IF NOT EXISTS "ResearchArea_searchVec_idx" ON "ResearchArea" USING GIN ("searchVec");

-- Course: GIN on existing searchText + trigram on code
CREATE INDEX IF NOT EXISTS "Course_searchText_gin_idx" ON "Course" USING GIN (to_tsvector('english', "searchText"));
CREATE INDEX IF NOT EXISTS "Course_code_trgm_idx" ON "Course" USING GIN ("code" gin_trgm_ops);

-- HandbookPage: GIN on existing searchText
CREATE INDEX IF NOT EXISTS "HandbookPage_searchText_gin_idx" ON "HandbookPage" USING GIN (to_tsvector('english', "searchText"));

-- Download: tsvector on title + description + category
ALTER TABLE "Download" ADD COLUMN IF NOT EXISTS "searchVec" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
        setweight(to_tsvector('english', coalesce("category", '')), 'C')
    ) STORED;
CREATE INDEX IF NOT EXISTS "Download_searchVec_idx" ON "Download" USING GIN ("searchVec");

-- AcademicCalendarEntry: tsvector on title + description
ALTER TABLE "AcademicCalendarEntry" ADD COLUMN IF NOT EXISTS "searchVec" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("description", '')), 'B')
    ) STORED;
CREATE INDEX IF NOT EXISTS "AcademicCalendarEntry_searchVec_idx" ON "AcademicCalendarEntry" USING GIN ("searchVec");

-- JournalIssue: tsvector on title + description
ALTER TABLE "JournalIssue" ADD COLUMN IF NOT EXISTS "searchVec" tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
        setweight(to_tsvector('english', coalesce("description", '')), 'B')
    ) STORED;
CREATE INDEX IF NOT EXISTS "JournalIssue_searchVec_idx" ON "JournalIssue" USING GIN ("searchVec");

-- Article: GIN on existing searchText
CREATE INDEX IF NOT EXISTS "Article_searchText_gin_idx" ON "Article" USING GIN (to_tsvector('english', "searchText"));
