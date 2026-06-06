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

## Phase 1.5: Operations CMS

The next layer keeps the existing static SEO URLs intact, but adds an operations layer on top of every URL in `sitemap.xml`.

- `/cms/` includes a `页面矩阵` workspace.
- `/api/cms/pages` lists all sitemap URLs with team ownership and operating status.
- `/api/cms/page` saves one URL record.
- URL records are stored in `data/cms/pages.jsonl`.
- Every URL can be assigned to a team:
  - AEIS 团队
  - O-Level 团队
  - WACE 团队
  - 公立大学团队
  - 私立大学团队
  - 国际学校团队
  - 综合运营团队
- Each URL has editable operating metadata:
  - title
  - owner
  - status
  - review status
  - image status
  - image brief
  - AI prompt
  - operation notes

This phase is intentionally not a WordPress migration. It gives the team a real daily operating console first, while the public site still uses fast static HTML and the current SEO-friendly URL structure.

## Upgrade Path: Full CMS

The current API and status fields are intentionally compatible with a future database-backed CMS.

Planned extensions:

- Team accounts and roles, replacing the single shared password.
- Media library and image upload, so editors can attach hero images and inline images without code changes.
- URL-level content editor for school pages, pathway pages, and pillar pages.
- Revision history for every article and URL page.
- Scheduled publishing.
- Content collections and taxonomy management.
- CRM lead sync for consultation forms and WeChat conversion events.
- AI generation queue that creates drafts, then requires human approval before publishing.
- Role-based review workflow:
  - writer creates or edits
  - team lead reviews
  - admin publishes

Future work should keep `/api/cms/*` as the stable internal API namespace.
