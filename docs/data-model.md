# Data Model Specification — ResumeForge

## 1. Overview & Entity Relationship Overview

This document specifies the domain data model for ResumeForge. Phase 2 implemented the core models (`Resume`, `EvidenceItem`, `Bullet`) in `prisma/schema.prisma`.

```
  +------------------+         1:N         +--------------------+
  |      Resume      |-------------------->|    EvidenceItem    |
  |  (Master Record) |                     |  (Verified Bank)   |
  +------------------+                     +--------------------+
           |                                         |
           | 1:N                                     | Cites N:M
           v                                         v
  +------------------+         1:N         +--------------------+
  |   ResumeVariant  |<-------------------|       Patch        |
  | (Tailored Draft) |                     |   (Proposed Diff)  |
  +------------------+                     +--------------------+
           |                                         ^
           | Belongs to 1                            | Belong to 1
           v                                         |
  +------------------+-------------------------------+
  |       Job        |
  |  (Target Posting)|
  +------------------+
```

---

## 2. Entity Definitions & Implemented Fields

### 1. `Resume` (Master Resume & Variants)
*Note on Phase 2 Implementation*: In our Typst-native architecture, full contact details and summary are authored directly inside `typstSource`.
- **`id`** (String, PK): Unique identifier (UUID).
- **`title`** (String): Resume title (e.g. "Master Resume").
- **`typstSource`** (String): Full Typst markup source code.
- **`isMaster`** (Boolean, default `false`): Flag indicating if this record is the current active Master Resume.
- **`isProtected`** (Boolean, default `true`): Prevents accidental deletion.
- **`factSnapshot`** (Json, Optional): Phase 11 deterministic fact snapshot (`ResumeFacts`, version 1) freezing employers, titles, date ranges, metrics, and skills at save time.
- **`createdAt`** (DateTime): Timestamp of creation.
- **`updatedAt`** (DateTime): Timestamp of last update.

### 2. `EvidenceItem` (Verified Evidence Bank)
- **`id`** (String, PK): Unique identifier (UUID).
- **`type`** (String): Domain category (`experience`, `project`, `skill`, `education`, `award`, `metric`).
- **`title`** (String): Role, project title, or skill domain.
- **`organization`** (String, Optional): Employer, university, or platform name.
- **`dates`** (String, Optional): Active dates or timeframe string (e.g. "Jun 2024 – Present").
- **`verifiedSummary`** (String): High-level verified claim or accomplishment description.
- **`tags`** (String): JSON array string of skill/tool tags (e.g. `["TypeScript", "React"]`).
- **`status`** (String, default `"verified"`): State status (`verified`, `draft`, `archived`).
- **`createdAt`** (DateTime): Creation timestamp.
- **`updatedAt`** (DateTime): Timestamp of last update.
- **`bullets`** (Bullet[]): One-to-many relationship with bullet entries.

### 3. `Bullet` (Resume Experience/Project Bullet)
- **`id`** (String, PK): Unique identifier (UUID).
- **`evidenceId`** (String, FK): Foreign key to parent `EvidenceItem`.
- **`text`** (String): Rendered bullet text claim.
- **`technologies`** (String): JSON array string of associated technology tags.
- **`roleAffinity`** (String): JSON array string of target role profiles (e.g. `["Backend", "Fullstack"]`).
- **`verified`** (Boolean, default `true`): Verification status flag.
- **`orderIndex`** (Int, default `0`): Sort position within parent evidence item.
- **`createdAt`** (DateTime): Creation timestamp.
- **`updatedAt`** (DateTime): Timestamp of last update.

### 4. `Job` (Job Description Posting — Phase 3 Implementation)
- **`id`** (String, PK): Unique identifier (UUID).
- **`company`** (String, Optional): Employer/Company name.
- **`roleTitle`** (String, Optional): Target job title.
- **`rawDescription`** (String): Full pasted job description text.
- **`source`** (String, default `"pasted"`): Source of job description (`pasted` | `manual`).
- **`extractedRequirements`** (String, JSON): Extracted requirements JSON matching `JobRequirementsSchema` (`requiredSkills`, `preferredSkills`, `domainTerms`).
- **`createdAt`** (DateTime): Creation timestamp.

### 5. `ResumeVariant` (Job-Specific Tailored Resume — Phase 4.2 Implementation)
- **`id`** (String, PK): Unique identifier.
- **`masterResumeId`** (String, FK): Parent master resume.
- **`jobId`** (String, FK): Target job posting.
- **`variantTitle`** (String): Custom name.
- **`typstContent`** (String): Generated Typst markup document.
- **`status`** (String): `DRAFT`, `REVIEWED`, `EXPORTED`.
- **`createdAt`** (DateTime): Creation timestamp.
- **`updatedAt`** (DateTime): Timestamp of last update.

### 6. `Patch` (AI-Proposed Structured Diff — Phase 4.2 Implementation)
- **`id`** (String, PK): Unique identifier.
- **`variantId`** (String, FK): Target resume variant draft.
- **`operation`** (String): `MODIFY_BULLET`, `ADD_SKILL`, `REORDER_BULLETS`, `TWEAK_SUMMARY`, `REPORT_GAP`.
- **`targetSection`** (String): Affected resume section.
- **`targetId`** (String, Optional): Target bullet or item ID.
- **`beforeContent`** (String): Original text.
- **`afterContent`** (String): Proposed text.
- **`evidenceCitations`** (String, JSON): Array of cited `evidenceIds`.
- **`rationale`** (String): Explanation of why this patch improves job match.
- **`confidence`** (Float): AI confidence score 0.0–1.0.
- **`status`** (String): `PENDING`, `ACCEPTED`, `REJECTED`, `REJECTED_CITATION`.

### 7. `CoverLetter` (Optional Tailored Artifact — Future Phase)
- **`id`** (String, PK): Unique identifier.
- **`variantId`** (String, FK): Associated resume variant.
- **`jobId`** (String, FK): Target job posting.
- **`content`** (String): Cover letter text/Typst content.
- **`createdAt`** (DateTime): Creation timestamp.
