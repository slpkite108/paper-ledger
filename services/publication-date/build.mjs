import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
mkdirSync('dist/server', { recursive: true });
copyFileSync('worker.mjs', 'dist/server/index.js');
copyFileSync('journals.mjs', 'dist/server/journals.mjs');
writeFileSync('dist/server/wrangler.json', JSON.stringify({ name: 'paper-ledger-publication-date-api', main: 'index.js', compatibility_date: '2026-09-01' }, null, 2));
