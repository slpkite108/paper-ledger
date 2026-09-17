import { safeUrl, type Paper } from '@/lib/papers';

export function AuthorIdentityDetails({ paper }: { paper: Paper }) {
  const identity = paper.authorIdentity;
  if (!identity) return null;
  return <div className={'author-identity-details ' + identity.status}>
    <p><strong>논문에 기재된 저자:</strong> {identity.rawName || '미상'}</p>
    <p><strong>논문 기재 소속:</strong> {identity.affiliations.join(' / ') || '정보 없음'}</p>
    <p><strong>선택한 저자의 최근 소속:</strong> {identity.expectedAffiliations.join(' / ') || '정보 없음'}</p>
    {identity.reason && <p>{identity.reason}</p>}
    {identity.sources?.map((url, i) => <a key={url} href={safeUrl(url)} target="_blank" rel="noopener noreferrer">{i === 0 ? '원문 확인' : '연구자 소개 확인'} ↗ </a>)}
  </div>;
}

export function AuthorIdentityReview({ papers }: { papers: Paper[] }) {
  const flagged = papers.filter(p => p.authorIdentity && p.authorIdentity.status !== 'reported');
  if (!flagged.length) return null;
  const excluded = flagged.filter(p => p.authorIdentity?.status === 'excluded').length;
  return <details className="author-identity-review">
    <summary>불러온 자료의 저자 확인 · 다른 저자로 확인되어 제외 {excluded}편 · 소속·식별자 확인 필요 {flagged.length - excluded}편</summary>
    <p>제외 자료는 논문 목록과 CSV·Excel에 포함되지 않습니다. 확인 필요 자료는 목록에 유지되므로 원문 확인 후 내보낼 행을 선택하세요.</p>
    {flagged.map(p => <section key={p.id}>
      <strong>{p.authorIdentity?.status === 'excluded' ? '제외' : '확인 필요'} · {p.values.title}</strong>
      <small>참여교수: {p.values.professor}</small>
      <AuthorIdentityDetails paper={p}/>
      <a href={safeUrl(p.values.link || p.source)} target="_blank" rel="noopener noreferrer">논문 출처 ↗</a>
    </section>)}
  </details>;
}
