# Paper Ledger publication date API

Read-only companion for the public GitHub Pages app. GET `/api/publication-date?doi=...` resolves supported Tech Science Press DOI links, reads `citation_publication_date` or `citation_online_date`, verifies the DOI and returns a date with provenance. Only `10.32604/` identifiers and HTTPS redirects to doi.org / techscience.com are supported. Arbitrary URLs, account information, Google tokens, and API keys are not accepted.

Responses contain public bibliographic facts only. Successful results are cached for 24 hours. Limits: 15-second lookup deadline, 1MB HTML, 6 requests per redirect chain, 60 uncached requests per minute per client in each running isolate. This is a best-effort local limiter, not a global quota. Source failures keep the app's current date for review.

No runtime secrets, database or file storage are required. `npm test` runs offline fixtures; `npm run build` emits a Cloudflare Worker. The Sites hosting manifest binds this separate API service; the existing private Sites app is unchanged. Public access must be explicitly authorized before enabling cross-site production use.

## Journal author search

GET /api/journal-search?source=hcis&author=Byeong-Seok%20Shin&from=2025&to=2026&page=1 searches the HCIS publisher's public advanced author field. Results are candidates, not proof of author identity. The browser asks users to verify authorship before importing. The endpoint receives only the public author search string, source, years and page; never Google account identifiers, tokens, API keys or edited papers.

The adapter reads the HCIS issue list and at most 20 HCIS detail pages for DOI metadata with two concurrent workers, a shared 25-second timeout and 1MB/page bound. Only fixed HTTPS hcisj.com paths are fetched; arbitrary URLs and redirects are rejected. Springer-era entries retain their external source/DOI links without server-side fetching. Missing detail DOI does not erase a candidate. Source layout errors remain errors rather than empty success. The UI follows next-page cursors explicitly. Results are cached for six hours; a best-effort per-isolate limiter allows ten uncached requests per client per minute. HCIS robots.txt was Allow: / on 2026-09-16.

Crossref journal search runs directly in the Pages client using validated ISSNs and query.author. Its fuzzy candidates require human identity review. This service is not a universal publisher crawler and journal registration does not establish SCIE status.
