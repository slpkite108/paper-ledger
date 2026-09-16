import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowUpRight, FileSearch, Info, Library, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { emptyPatentQuery, kiprisSearchUrl, patentSearchExpression, type PatentQuery } from '@/lib/patent-search';

export function PatentSearchPage() {
  const [query, setQuery] = useState<PatentQuery>({ ...emptyPatentQuery });
  const [error, setError] = useState('');
  const result = patentSearchExpression(query);
  function update(key: keyof PatentQuery, value: string) { setQuery(previous => ({ ...previous, [key]: value })); setError(''); }
  function search(event: FormEvent<HTMLFormElement>) {
    if (result.error) { event.preventDefault(); setError(result.error); }
    else setError('');
  }
  return <div className="app-shell patent-shell">
    <header className="topbar">
      <a href="#/papers" className="brand"><span className="brand-mark"><Library size={23}/></span>논문대장<span className="brand-caption">PATENT SEARCH</span></a>
      <a href="#/papers" className="page-switch-link"><ArrowLeft size={17}/>논문 검색으로 돌아가기</a>
    </header>
    <main className="patent-page">
      <nav className="research-navigation" aria-label="검색 페이지">
        <a href="#/papers">논문 검색</a><a href="#/patents" aria-current="page">국내 특허 검색</a>
      </nav>
      <div className="patent-heading">
        <div><div className="step-label">DOMESTIC PATENTS</div><h1 tabIndex={-1}>국내 특허 검색</h1><p>발명자와 출원기관을 기준으로 특허·실용신안을 찾아보세요.</p></div>
        <span className="patent-source"><FileSearch size={17}/>KIPRIS 공식 검색</span>
      </div>
      <div className="patent-grid">
        <section className="patent-search-card" aria-labelledby="patent-conditions">
          <h2 id="patent-conditions">검색 조건</h2>
          <p className="patent-description">한 항목만 입력해도 됩니다. 여러 항목을 입력하면 모든 조건을 함께 적용합니다.</p>
          <form action={kiprisSearchUrl} method="post" target="_blank" rel="noopener noreferrer" onSubmit={search}>
            <input type="hidden" name="queryTextTop" value={result.expression}/>
            <input type="hidden" name="queryText" value={result.expression}/>
            <div className="patent-fields">
              <div><label htmlFor="patent-inventor">발명자</label><Input id="patent-inventor" value={query.inventor} onChange={e => update('inventor', e.target.value)} placeholder="발명자 이름" maxLength={200}/><p>교수·연구자의 이름을 입력하세요.</p></div>
              <div><label htmlFor="patent-applicant">출원인</label><Input id="patent-applicant" value={query.applicant} onChange={e => update('applicant', e.target.value)} placeholder="대학교 산학협력단, 기업 등" maxLength={200}/><p>동명이인은 출원기관을 함께 확인하세요.</p></div>
              <div><label htmlFor="patent-title">특허명</label><Input id="patent-title" value={query.title} onChange={e => update('title', e.target.value)} placeholder="발명의 명칭 또는 핵심 단어" maxLength={200}/></div>
              <div><label htmlFor="patent-number">출원번호</label><Input id="patent-number" value={query.applicationNumber} onChange={e => update('applicationNumber', e.target.value)} placeholder="예: 10-2022-0086672" maxLength={30}/></div>
            </div>
            {error && <p className="patent-error" role="alert">{error}</p>}
            <div className="patent-submit"><Button type="submit"><Search size={17}/>KIPRIS에서 검색<ArrowUpRight size={16}/></Button><Button variant="outline" type="button" onClick={() => { setQuery({ ...emptyPatentQuery }); setError(''); }}>초기화</Button></div>
            <p className="patent-description">새 창에 검색 조건을 전달합니다. KIPRIS의 검색 버튼을 눌러 결과를 확인하세요. 입력한 조건은 이 페이지에 유지됩니다.</p>
          </form>
        </section>
        <aside className="patent-guide" aria-label="특허 검색 안내">
          <div className="patent-guide-icon"><FileSearch size={26}/></div>
          <h2>연구자의 특허 찾기</h2>
          <ol><li><strong>발명자 이름으로 검색</strong><p>논문 저자와 특허에 기재된 발명자 이름이 같은지 확인하세요.</p></li><li><strong>출원기관으로 범위 좁히기</strong><p>학교나 기업을 함께 입력하면 동명이인을 구분하는 데 도움이 됩니다.</p></li><li><strong>출원·등록 정보 확인</strong><p>KIPRIS 결과에서 번호·일자·행정상태와 원문을 확인할 수 있습니다.</p></li></ol>
          <a href="https://www.kipris.or.kr/khome/board/help/searchByRights.do?tab=patent" target="_blank" rel="noopener noreferrer">KIPRIS 검색 도움말<ArrowUpRight size={15}/></a>
        </aside>
      </div>
      <section className="patent-connection" aria-labelledby="patent-connection-title">
        <Info size={19}/><div><h2 id="patent-connection-title">앱 내 검색 결과 연동: 미연결</h2><p>현재 검색 조건은 KIPRIS로 전달됩니다. 이 페이지에서 결과를 모아 정리하는 기능은 KIPRIS Plus API 연결 후 사용할 수 있습니다.</p>
          <details><summary>API 이용 신청 안내</summary><ol><li><a href="https://plus.kipris.or.kr/" target="_blank" rel="noopener noreferrer">KIPRIS Plus<ArrowUpRight size={13}/></a>에서 회원가입 후 Open API 이용을 신청합니다.</li><li>국내 특허·실용 공개·등록공보 서비스의 이용 권한과 인증키를 발급받습니다.</li><li>발급 후 API 연결을 추가해야 앱 안에서 결과를 조회할 수 있습니다. 현재 페이지에는 인증키를 입력하거나 저장하는 기능이 없습니다.</li></ol></details>
        </div>
      </section>
    </main>
  </div>;
}
