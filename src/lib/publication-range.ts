export type PublicationRange = { from: string; to: string; fromMonth: string; toMonth: string };
export const emptyPublicationRange: PublicationRange = { from: '', to: '', fromMonth: '', toMonth: '' };

export function publicationRangeError(range: PublicationRange): string {
  if ([range.from, range.to].some(y => y && (!/^\d{4}$/.test(y) || +y < 1000 || +y > 2100))) return '조회 연도는 1000~2100 범위로 입력하세요.';
  if ([range.fromMonth, range.toMonth].some(m => m && !/^(0[1-9]|1[0-2])$/.test(m))) return '조회 월은 1~12월 중 선택하세요.';
  if ((!range.from && range.fromMonth) || (!range.to && range.toMonth)) return '월을 선택하려면 연도를 먼저 입력하세요.';
  if (range.from && range.to && range.from + (range.fromMonth || '01') > range.to + (range.toMonth || '12')) return '시작 연월이 종료 연월보다 늦을 수 없습니다.';
  return '';
}

export function publicationInRange(value: string, range: PublicationRange, includeUnknownMonths: boolean): boolean {
  if (!range.from && !range.to) return true;
  const lower = range.from ? range.from + '-' + (range.fromMonth || '01') : '0000-01';
  const upper = range.to ? range.to + '-' + (range.toMonth || '12') : '9999-12';
  if (/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/.test(value)) return value.slice(0, 7) >= lower && value.slice(0, 7) <= upper;
  if (/^\d{4}$/.test(value)) {
    const earliest = value + '-01', latest = value + '-12';
    if (latest < lower || earliest > upper) return false;
    // A year-only date is certain to fall within a range covering that whole year.
    return (earliest >= lower && latest <= upper) || includeUnknownMonths;
  }
  return includeUnknownMonths;
}

export function publicationRangeLabel(range: PublicationRange): string {
  const endpoint = (year: string, month: string) => year ? year + (month ? '-' + month : '년') : '전체';
  return endpoint(range.from, range.fromMonth) + ' – ' + endpoint(range.to, range.toMonth);
}
