import type { Author, Work } from './papers';

export type AuthorIdentity = {
  status: 'reported' | 'review' | 'excluded';
  rawName: string;
  affiliations: string[];
  expectedAffiliations: string[];
  reason?: string;
  sources?: string[];
};

const lastId = (value?: string | null) => value?.split('/').pop() || '';
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const doiOf = (value?: string | null) => (value || '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').toLowerCase().trim();

// Verified 2026-09-17 against the paper's final-page affiliation/email and SKKU's
// Bomi Shin profile. OpenAlex incorrectly links B. Shin to Byeong-Seok Shin.
// Scope corrections to both a specific work and a specific researcher identity.
const plaqueDois = new Set(['10.1016/j.jmaa.2025.130131', '10.48550/arxiv.2510.05493']);
function confirmedOtherAuthor(work: Work, author: Author) {
  const targetResearcher = author.orcid ? lastId(author.orcid) === '0000-0001-7742-4846' : lastId(author.id) === 'A5061420652';
  return targetResearcher &&
    (plaqueDois.has(doiOf(work.doi)) || lastId(work.id) === 'W4415122165');
}

export function assessAuthorIdentity(work: Work, author: Author): AuthorIdentity | undefined {
  const self = work.authorships?.find(a => lastId(a.author?.id) === lastId(author.id));
  const expected = author.last_known_institutions || [];
  const institutions = self?.institutions || [];
  const reportedAffiliations = (self?.raw_affiliation_strings || []).filter(Boolean);
  const affiliations = reportedAffiliations.length ? reportedAffiliations : institutions.map(i => i.display_name);
  const base = { rawName: self?.raw_author_name || self?.author?.display_name || '', affiliations, expectedAffiliations: expected.map(i => i.display_name) };
  if (confirmedOtherAuthor(work, author)) return {
    ...base, status: 'excluded', rawName: 'B. Shin (Bomi Shin)',
    affiliations: ['Department of Mathematics, Sungkyunkwan University'],
    reason: '원문의 소속·이메일과 성균관대학교 연구자 소개를 대조해 Bomi Shin의 논문으로 확인했습니다. OpenAlex가 인하대학교 Byeong-Seok Shin에 잘못 연결한 자료로, 이 참여교수의 목록·CSV·Excel에서 제외합니다.',
    sources: ['https://arxiv.org/pdf/2510.05493#page=17', 'https://swb.skku.edu/aorc/research_fellows.do?articleNo=25635&mode=view'],
  };
  if (!self) return undefined;
  // author.orcid is OpenAlex's inferred profile identifier, not independent
  // evidence. Only raw_orcid represents the identifier supplied by this work.
  if (self.raw_orcid && author.orcid && lastId(self.raw_orcid) !== lastId(author.orcid)) return {
    ...base, status: 'review', reason: '논문에 직접 등록된 ORCID가 선택한 저자의 ORCID와 다릅니다. 저자를 원문에서 확인하세요.',
  };
  const knownExpected = expected.filter(i => i.display_name || i.id);
  const knownInstitutions = institutions.filter(i => i.display_name || i.id);
  const overlap = knownExpected.some(a => knownInstitutions.some(b =>
    Boolean(a.id && b.id && lastId(a.id) === lastId(b.id)) || Boolean(a.display_name && b.display_name && normalize(a.display_name) === normalize(b.display_name))));
  if (knownExpected.length && knownInstitutions.length && !overlap) return {
    ...base, status: 'review', reason: '논문 기재 소속과 선택한 저자의 최근 소속이 다릅니다. 소속 이동·겸임 또는 동명이인 여부를 확인하세요. 소속 차이만으로 자동 제외하지 않습니다.',
  };
  return { ...base, status: 'reported' };
}
