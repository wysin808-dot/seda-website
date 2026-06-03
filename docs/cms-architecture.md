# SEDA CMS Architecture

SEDA currently uses a lightweight CMS designed for daily SEO article operations.

## Phase 1: Lite CMS

- Password login with signed HTTP-only session cookie.
- Markdown files in `content/articles` are the content source of truth.
- Article status is stored in frontmatter:
  - `draft: true | false`
  - `reviewStatus: pending | needs_revision | approved`
  - `reviewNote`
  - `updated`
  - `reviewedAt`
  - `publishedAt`
- Publishing triggers `npm run content:build`, which regenerates article HTML, latest article blocks, review page, and `sitemap.xml`.
- `/cms/` is the human editor.
- `/content-review/` remains the simple review page for quick access.

## Upgrade Path: Full CMS

The current API and status fields are intentionally compatible with a future database-backed CMS.

Planned extensions:

- User accounts and roles.
- Media library and image upload.
- Revision history.
- Scheduled publishing.
- Content collections and taxonomy management.
- CRM lead sync.
- AI generation queue and approval workflow.

Future work should keep `/api/cms/*` as the stable internal API namespace.
