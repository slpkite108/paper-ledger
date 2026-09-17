import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
await build({ configFile: false, logLevel: 'silent', build: { outDir: '.build/author-identity-test', emptyOutDir: false, target: 'esnext', lib: { entry: resolve('tests/author-identity-entry.ts'), formats: ['es'], fileName: () => 'app.mjs' } } });
const a = await import(pathToFileURL(resolve('.build/author-identity-test/app.mjs')).href);
const inha = { id: 'https://openalex.org/I191879574', display_name: 'Inha University' };
const skku = { id: 'https://openalex.org/I848706', display_name: 'Sungkyunkwan University' };
const author = { id: 'https://openalex.org/A5061420652', display_name: 'Byeong‐Seok Shin', orcid: 'https://orcid.org/0000-0001-7742-4846', last_known_institutions: [inha] };
// Minimal reproduction of OpenAlex W4415122165, checked 2026-09-17.
const work = { id: 'https://openalex.org/W4415122165', doi: 'https://doi.org/10.1016/j.jmaa.2025.130131', title: 'On the plaque topological stability of partially hyperbolic diffeomorphisms', type: 'article', publication_date: '2026-03-01', primary_location: { source: { type: 'journal' } }, authorships: [{ author: { id: 'https://openalex.org/A5100441194', display_name: 'Liang Li' }, author_position: 'first' }, { author: { id: author.id, display_name: author.display_name, orcid: author.orcid }, raw_author_name: 'B. Shin', raw_orcid: null, institutions: [skku], raw_affiliation_strings: ['Department of Mathematics, SungKyunKwan University, Suwon, 16419, Republic of Korea'] }] };
const otherWork = changes => ({ ...work, id: 'https://openalex.org/W2', doi: 'https://doi.org/10.1234/other', title: 'Other research', ...changes });
const options = { excludeArxiv: false, mergeLatest: true, publicationKind: 'all' };
test('verified incorrect assignment is excluded from visible rows and export input', () => {
  const wrong = a.toPaper(work, author, author.display_name);
  assert.equal(wrong.authorIdentity.status, 'excluded');
  assert.equal(wrong.authorIdentity.rawName, 'B. Shin (Bomi Shin)');
  assert.match(wrong.authorIdentity.sources[0], /2510.05493/);
  const normal = a.toPaper(otherWork({ authorships: [{ author: { id: author.id }, institutions: [inha] }] }), author, 'Researcher');
  const visible = a.visiblePublications([wrong, normal], options);
  assert.deepEqual(visible.map(p => p.id), [normal.id]);
  assert.doesNotMatch(a.layoutCsv(visible, a.defaultLayout()), /plaque topological stability/);
});
test('correction is work-and-researcher scoped and does not suppress the genuine author', () => {
  assert.notEqual(a.assessAuthorIdentity(work, { ...author, id: 'A-bomi', orcid: 'https://orcid.org/0000-0000-0000-0001' })?.status, 'excluded');
  assert.notEqual(a.assessAuthorIdentity(work, { ...author, orcid: 'https://orcid.org/0000-0000-0000-0001' })?.status, 'excluded');
  assert.equal(a.assessAuthorIdentity({ ...work, id: 'arxiv', doi: '10.48550/arXiv.2510.05493' }, author)?.status, 'excluded');
  assert.equal(a.assessAuthorIdentity(otherWork({}), author)?.status, 'review');
});
test('different affiliation is a review signal, never an automatic exclusion', () => {
  const paper = a.toPaper(otherWork({}), author, 'Researcher');
  assert.equal(paper.authorIdentity.status, 'review');
  assert.match(paper.authorIdentity.affiliations[0], /SungKyunKwan/);
  assert.equal(a.visiblePublications([paper], options).length, 1);
});
test('affiliation belongs to the selected authorship, not a coauthor', () => {
  const mixed = otherWork({ authorships: [{ author: { id: 'A-other' }, institutions: [skku] }, { author: { id: author.id }, institutions: [inha] }] });
  assert.equal(a.assessAuthorIdentity(mixed, author).status, 'reported');
  assert.equal(a.assessAuthorIdentity(otherWork({ authorships: [{ author: { id: author.id }, institutions: [skku, inha] }] }), author).status, 'reported');
});
test('missing affiliations remain unknown and saved institution names still match', () => {
  assert.equal(a.assessAuthorIdentity(otherWork({ authorships: [{ author: { id: author.id } }] }), author).status, 'reported');
  assert.equal(a.assessAuthorIdentity(otherWork({ authorships: [{ author: { id: author.id }, institutions: [inha] }] }), { ...author, last_known_institutions: [{ display_name: 'Inha University' }] }).status, 'reported');
  assert.equal(a.assessAuthorIdentity(otherWork({ authorships: [] }), author), undefined);
});
test('profile ORCID is not treated as independent work evidence; raw ORCID conflicts require review', () => {
  const mismatch = otherWork({ authorships: [{ author: { id: author.id, orcid: author.orcid }, raw_orcid: 'https://orcid.org/0000-0000-0000-0001', institutions: [inha] }] });
  assert.equal(a.assessAuthorIdentity(mismatch, author).status, 'review');
});
test('Crossref enrichment preserves verified exclusions', () => {
  const paper = a.toPaper(work, author, 'Researcher');
  const updated = a.applyCrossref(paper, a.crossrefData({ DOI: '10.1016/j.jmaa.2025.130131', type: 'journal-article', 'published-print': { 'date-parts': [[2026, 3]] } }));
  assert.equal(updated.authorIdentity.status, 'excluded');
  assert.equal(a.visiblePublications([updated], options).length, 0);
});
