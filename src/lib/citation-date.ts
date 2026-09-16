import { dateFromParts, normalizedDoi, type DateCandidate } from './publication-dates';

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseDate(value = '') {
  const match = value.trim().match(/^(\d{4})(?:[-/](\d{1,2})(?:[-/](\d{1,2}))?)?\/*$/);
  return match ? dateFromParts({ 'date-parts': [match.slice(1).filter(v => v !== undefined).map(Number)] }) : '';
}
function decode(value: string) {
  return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (all, hex, dec) => {
    const n = parseInt(hex || dec, hex ? 16 : 10); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
  });
}
// Extract only inert metadata. Imported HTML is never inserted into the document.
export function citationDate(text: string, expectedDoi: string, url = ''): DateCandidate {
  if (text.length > 1_000_000) throw new Error('인용정보는 1MB 이하로 가져오세요.');
  const dates: string[] = []; let doi = ''; let kind = '';
  if (/<meta\b/i.test(text)) {
    const metadata = new Map<string, string>();
    for (const tag of text.matchAll(/<meta\b[^>]*>/gi)) {
      const attributes = new Map([...tag[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(m => [m[1].toLowerCase(), decode(m[2] ?? m[3])]));
      const name = attributes.get('name')?.toLowerCase();
      if (name) metadata.set(name, attributes.get('content') || '');
    }
    doi = metadata.get('citation_doi') || '';
    for (const key of ['citation_publication_date', 'citation_online_date', 'citation_date', 'citation_year']) dates.push(parseDate(metadata.get(key)));
    kind = 'HTML citation 메타데이터';
  } else if (/^TY\s*-\s*\S+/m.test(text)) {
    if ([...text.matchAll(/^TY\s*-/gm)].length !== 1) throw new Error('논문 1편의 RIS만 가져오세요.');
    const field = (key: string) => text.match(new RegExp('^' + key + '\\s*-\\s*(.*)$', 'm'))?.[1].trim() || '';
    doi = field('DO');
    for (const key of ['DA', 'Y1', 'PY']) dates.push(parseDate(field(key)));
    kind = 'RIS';
  } else if (/^\s*@\w+\s*[{(]/.test(text)) {
    if ([...text.matchAll(/@\w+\s*[{(]/g)].length !== 1) throw new Error('논문 1편의 BibTeX만 가져오세요.');
    const field = (key: string) => text.match(new RegExp('(?:[,\\n])\\s*' + key + '\\s*=\\s*(?:\\{([^{}]*)\\}|"([^"]*)"|([^,}\\s]+))', 'i'))?.slice(1).find(v => v !== undefined)?.trim() || '';
    doi = field('doi'); dates.push(parseDate(field('date')));
    const year = field('year'), rawMonth = field('month');
    const month = /^\d{1,2}$/.test(rawMonth) ? +rawMonth : rawMonth ? months.indexOf(rawMonth.toLowerCase().slice(0, 3)) + 1 : undefined;
    dates.push(dateFromParts({ 'date-parts': [[Number(year), ...(month === undefined ? [] : [month])]] }));
    kind = 'BibTeX';
  } else throw new Error('RIS, BibTeX 또는 citation 메타데이터가 포함된 논문 페이지 HTML을 가져오세요.');
  if (!expectedDoi || !doi || normalizedDoi(doi) !== normalizedDoi(expectedDoi)) throw new Error('인용정보의 DOI가 현재 논문과 일치해야 합니다. 다른 논문이나 참고문헌은 적용하지 않습니다.');
  const date = dates.find(d => d.length >= 7) || dates.find(Boolean);
  if (!date) throw new Error('인용정보에서 유효한 출판일을 찾지 못했습니다. 원문에서 확인해 직접 입력하세요.');
  let sourceUrl = '';
  try { const parsed = new URL(url); if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) sourceUrl = parsed.href; } catch { /* Local citation file. */ }
  return { source: 'publisher-citation', date, url: sourceUrl, note: kind + ' · DOI 일치', checkedOn: new Date().toISOString().slice(0, 10) };
}

export async function fetchCitationDate(url: string, doi: string): Promise<DateCandidate> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new Error('출판사 논문 또는 인용파일의 전체 URL을 입력하세요.'); }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('공개 http/https 출처 주소를 입력하세요.');
  let response: Response;
  try { response = await fetch(parsed.href, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(10000) }); }
  catch { throw new Error('출처 연결 실패 또는 브라우저 교차 출처 제한입니다. 출처에서 인용파일이나 HTML을 저장해 아래에서 가져오세요.'); }
  if (!response.ok) throw new Error('출처에서 응답을 거절했습니다 (' + response.status + '). 인용파일이나 HTML을 저장해 가져오세요.');
  return citationDate(await response.text(), doi, url);
}
