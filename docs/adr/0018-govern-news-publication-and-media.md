---
status: accepted
---

# Govern News Article publication and media explicitly

ProLeague will use one categorized Ukrainian-language News Article model for news, announcements, and federation decisions. Articles use a versioned structured content document instead of arbitrary HTML or plain Markdown so the Admin preview and server-rendered public page share the same validated semantic rendering while published history remains reproducible.

## Consequences

A News Article contains a required Admin-managed category, title, stable slug, summary, structured body, cover image, responsible Admin, immutable first-publication time, and optional SEO metadata. Initial categories are News, Announcement, and Federation Decision; used categories may be renamed or archived but not deleted. An Article may have explicit many-to-many associations with Competitions, Seasons, Teams, Matches, and Players. Associations are optional and textual mentions never create them automatically; links to Private entities appear only after those entities become Public.

The editorial lifecycle is Draft, Scheduled, Published, or Archived. An authenticated Admin can preview Draft and Scheduled content using the same renderer as the public page. Scheduled content publishes automatically in the Portal's `Europe/Kyiv` timezone and may be edited, rescheduled, or returned to Draft beforehand. Readiness is validated both when scheduling and at the due time; an invalid attempt exposes nothing and remains recorded for Admin attention. Public preview links and a separate approval role are outside the MVP.

Published content never returns to Draft. Archival removes an Article from current feeds but preserves its stable, indexable canonical URL and archive-search presence; restoration retains its original publication time. Only a never-published Draft may be physically deleted. A slug is fixed after first publication; an exceptional audited change creates a permanent redirect from every former slug. A separate original publication timestamp is reserved for future historical imports rather than allowing ordinary backdating.

Editing a Published Article creates a Working Revision while the current Published Revision remains public. Publishing the replacement is an explicit Admin action with a mandatory internal reason. A material factual Article Correction additionally requires a public explanation and visible updated indication, but never changes the first-publication time. Scheduling future replacements of an already Published Article is outside the MVP. Optimistic concurrency prevents a stale editing session from silently overwriting newer work.

Drafts and Working Revisions are autosaved to the authoritative server store with a limited set of recovery snapshots; a browser copy may only be temporary recovery data. Each structured document carries a content-schema version. Incompatible content migrations create a new revision rather than silently rewriting published history. Supported content includes paragraphs, second- and third-level headings, emphasis, lists, validated HTTPS links, quotations, accessible tables, inline images, and validated YouTube references. Arbitrary HTML, scripts, styles, iframes, and unsafe URL protocols are rejected.

A reusable Media Asset is immutable and records the original filename, type, size, dimensions, source, creator, usage-rights information, uploader, and upload time. JPEG, PNG, and WebP originals up to 10 MB are accepted; SVG, animated GIF, uploaded video, and audio are outside the MVP. EXIF metadata is removed, private originals are retained, and optimized responsive WebP or AVIF variants are generated without destructive cropping. A focal point guides cover, card, and social-preview variants.

Alternative text and caption have asset defaults but may be overridden by each Article Media Placement. Meaningful placements require alternative text, while decorative use must be explicit. Tables require a header row, may have a caption, do not support merged cells in the MVP, and remain usable on narrow screens. Publication requires title, slug, summary, body, active category, cover, and valid media accessibility metadata.

An unused Media Asset that never appeared in a Published Revision may be physically deleted. Once published, removal from current content does not remove it from historical revisions. When rights or another exceptional concern requires public removal, an audited Media Withdrawal substitutes a neutral public placeholder while preserving metadata, reason, responsible Admin, and historical references.

Multiple Published Articles may be Featured concurrently, optionally until a configured time. Public surfaces select the newest applicable items by feature time; ordinary feeds remain ordered by publication time and are not manually rearranged. Draft, Scheduled, preview, and Working Revision routes are not publicly indexable, while Published and Archived Articles retain their canonical indexing behavior.
