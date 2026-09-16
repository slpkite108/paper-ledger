# Paper Ledger publication date API

Read-only companion for the public GitHub Pages app. GET `/api/publication-date?doi=...` resolves supported Tech Science Press DOI links, reads `citation_publication_date` or `citation_online_date`, verifies the DOI and returns a date with provenance. Only `10.32604/` identifiers and HTTPS redirects to doi.org / techscience.com are supported. Arbitrary URLs, account information, Google tokens, and API keys are not accepted.

Responses contain public bibliographic facts only. Successful results are cached for 24 hours. Limits: 15-second lookup deadline, 1MB HTML, 6 requests per redirect chain, 60 uncached requests per minute per client in each running isolate. This is a best-effort local limiter, not a global quota. Source failures keep the app's current date for review.

No runtime secrets, database or file storage are required. `npm test` runs offline fixtures; `npm run build` emits a Cloudflare Worker. The separate API service is publicly available at https://paper-ledger-publication-dates.slpkite108.chatgpt.site after owner authorization (2026-09-16). The existing private Sites app is unchanged. The GitHub Pages build does not deploy this Worker. Deploy dist/server/index.js with the generated Wrangler configuration to your own Worker runtime, or configure a separate Sites service. The frontend endpoint is in src/lib/publisher-data.ts.
