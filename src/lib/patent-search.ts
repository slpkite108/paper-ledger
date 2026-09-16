export const kiprisSearchUrl = 'https://www.kipris.or.kr/khome/search/searchResult.do';

export type PatentQuery = { inventor: string; applicant: string; title: string; applicationNumber: string };
export const emptyPatentQuery: PatentQuery = { inventor: '', applicant: '', title: '', applicationNumber: '' };

// KIPRIS field codes: IN (inventor), AP (applicant), TL (title), AN (application number).
export function patentSearchExpression(query: PatentQuery): { expression: string; error: string } {
  const parts: string[] = [];
  for (const [key, code, label] of [
    ['inventor', 'IN', '발명자'], ['applicant', 'AP', '출원인'], ['title', 'TL', '특허명'],
  ] as const) {
    const value = query[key].trim().replace(/\s+/g, ' ');
    if (!value) continue;
    if (value.length > 200 || /[\[\]()=*+^!~<>|&"\\]/.test(value)) {
      return { expression: '', error: `${label}에는 검색 연산자 없이 이름이나 단어를 200자 이내로 입력하세요.` };
    }
    parts.push(`${code}=[${value}]`);
  }
  if (query.applicationNumber.trim()) {
    const number = query.applicationNumber.replace(/[\s-]/g, '');
    if (!/^(10|20)\d{11}$/.test(number)) return { expression: '', error: '국내 출원번호 13자리를 입력하세요. 예: 10-2022-0086672' };
    parts.push(`AN=[${number}]`);
  }
  return parts.length ? { expression: parts.join('*'), error: '' } : { expression: '', error: '발명자, 출원인, 특허명, 출원번호 중 하나 이상 입력하세요.' };
}
