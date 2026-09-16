# 개발·배포 안내

## 실행 구조

React + TypeScript + Vite 정적 앱입니다. 브라우저에서 OpenAlex와 Crossref를 호출하고, Google Identity Services와 Drive 앱 전용 저장소를 사용합니다. Tech Science Press 날짜 보완은 별도 공개 API를 사용합니다. 개발 진입점은 src/main.tsx이며 @ 별칭은 src/를 가리킵니다.

package-lock.json을 기준으로 npm ci를 실행합니다. npm run check는 타입을 확인하고 npm run build는 docs/에 JS·CSS가 포함된 index.html과 config.js, privacy.html, favicon.svg, .nojekyll을 생성합니다. docs/는 배포 결과이므로 직접 편집하지 않습니다. .build/와 node_modules/는 커밋하지 않습니다.

## 배포

1. 소스를 수정하고 npm run check, npm test, npm run build를 실행합니다.
2. 소스와 docs/ 변경을 함께 커밋합니다.
3. GitHub Settings → Pages의 Source는 Deploy from a branch, Branch는 main /docs로 유지합니다.
4. Pages 배포 완료 후 공개 주소에서 새 버전을 확인합니다. npm run preview로도 빌드 결과를 볼 수 있습니다.

## Google 연결

공개 OAuth 클라이언트 ID는 src/lib/google-config.json에서 관리합니다. 빌드 시 public/config.js와 docs/config.js에 반영됩니다. 웹 화면에서 ID를 등록하거나 브라우저마다 재정의하지 않습니다. 비밀값은 필요하지 않습니다.

Google 프로젝트의 승인된 JavaScript 원본은 https://slpkite108.github.io 입니다. 로컬 로그인 개발이 필요하면 개발용 원본도 별도로 등록해야 합니다. Drive API, 앱 전용 저장 권한과 테스트 사용자/게시 상태는 Google Cloud에서 관리합니다. 변경 없는 기존 사용자 데이터 접근 범위를 유지하세요.

Google 단기 액세스 토큰과 만료 시각·계정 식별자·클라이언트 ID는 탭의 sessionStorage에 저장합니다. 새로고침 시 userinfo를 확인한 뒤 연결을 복원하고 Google에 보관된 OpenAlex 키를 다시 읽습니다. localStorage와 배포 파일에는 자격 증명을 기록하지 않습니다. 만료 토큰 자동 갱신이나 서버 refresh token은 사용하지 않으므로 만료 후 사용자 재연결이 필요합니다. 계정 변경 중 진행 중이던 응답은 세대 번호로 차단합니다.

npm test는 새 페이지 모듈과 같은 세션 저장소를 사용해 새로고침, 복원 중 동시 요청, 만료·로그아웃·401·계정 불일치·저장소 차단·계정 전환을 검증합니다. Google 응답은 모의 응답이며 실제 계정 동의를 자동 수행하지 않습니다.

## 기능별 위치

- 검색·서지정보: client-api.ts, upstream.ts, papers.ts, crossref-data.ts
- 출판일 우선순위·정밀도: publication-dates.ts, publication-date-editor.tsx
- Cite 날짜 추출: citation-date.ts (HTML을 실행하거나 외부 프록시로 전송하지 않음)
- 출판사에서 직접 검증한 DOI별 날짜: verified-publication-dates.json (원문 URL·확인일·발행일 근거 필수)
- 연월 범위·검증: publication-range.ts, publication-range-controls.tsx (후보는 연도 단위, 보완 후 로컬 월 필터)
- 출판사 자동 연동: publisher-data.ts, services/publication-date/
- 중복·유형 필터: publications.ts
- 사용자 양식·다중 정렬·Excel: layouts.ts, ledger-export.ts
- Google 저장: google-store.ts
- 인정 기준: criteria.ts, recognition.ts, bk-cs-data.json

인정 자료를 갱신할 때 출처·자료판·조사일과 자동 대조 범위를 사용 안내에 같이 기록하세요. 발표 트랙 또는 기관 기준이 다르면 최종 인정 결과가 달라질 수 있습니다.

출판일 검증은 tests/publication-date.test.mjs에서 실제 오류 논문의 공개 메타데이터 fixture, 연도만 있는 날짜, 인쇄/온라인 날짜 차이, 잘못된 날짜, 사용자 지정값 보존, 정렬·CSV, DOI가 일치하는 인용정보와 CORS 실패 안내를 확인합니다. fixture는 2026-09-16 조회한 공개 서지정보의 발췌이며 원문 전체를 포함하지 않습니다. 출판사 수동 확인 목록은 DOI 완전 일치로만 적용합니다. 목록에 없는 논문의 월을 임의로 채우지 마세요.

GitHub Pages는 정적 호스팅이므로 CORS를 허용하지 않는 출판사 조회는 별도 읽기 전용 API에서 처리합니다. `services/publication-date/`에 배포한 Worker 원본·테스트가 있습니다. 그 폴더에서 `npm test`, `npm run build`로 검증·빌드합니다. GitHub Pages 빌드가 API를 자동 배포하지는 않습니다. 현재 API는 https://paper-ledger-publication-dates.slpkite108.chatgpt.site 에 공개되어 있으며 프런트 endpoint는 publisher-data.ts에서 관리합니다. API는 Tech Science Press DOI와 doi.org/techscience.com HTTPS 리디렉션만 허용하고 반환 DOI 일치, 날짜 유효성, 응답 크기·시간·동시 요청을 제한합니다. Google 계정·키·토큰을 받지 않습니다.

다른 출판사의 직접 Cite 조회는 CORS가 필요합니다. 출처 URL 직접 조회는 공개 요청(credentials omit)이며 실패 시 파일/붙여넣기 경로를 제공합니다. 무조건적인 외부 프록시나 CORS 우회 서비스는 사용하지 않습니다. 서지 보완은 DOI별 2개 동시 요청과 기존 upstream 캐시/요청 제한 처리를 사용합니다.

연월 회귀 검증은 같은 달/연도 경계, 기간 역전, 한쪽 범위, 월 미상 정책, 수정된 발행일, 필터 후 중복 처리·CSV, 기존 즐겨찾기 호환과 월 범위 보존을 포함합니다.

출판년월 정렬은 날짜 각 부분을 숫자로 비교합니다. published 원본 및 해당 필드에 연결한 양식 열, year/month 형식 열에 적용하며 월 미상은 같은 연도 내 마지막, 유효하지 않은 날짜는 유효 날짜 뒤에 둡니다. tests/chronological-sort.test.mjs는 연도·월 경계, 부분 날짜, 양식 매핑, 다중 정렬, CSV와 실제 XLSX 재열기 순서를 검증합니다.

## 인정 구분 자동 입력과 학술대회

자동 인정은 automatic-recognition.ts에서 현재 자료와 기준표 설정으로 파생합니다. 자동 생성값만 원복·재계산하며 수동 구분/근거 소유권을 보존합니다. 학술대회는 BK 공식 첨부 목록만 사용하며 KIISE 권장 목록을 BK로 변환하지 않습니다. IEEE SCIE 자료는 2026년 8월 공식 XLSX의 첫 시트 Title List (All), Index=SCIE 행 167개입니다. JIF와 ESCI를 SCIE의 대용으로 사용하지 않습니다. h5 내장 수치/실시간 전체 조회는 없으며 사용자가 출처·연도를 기록한 기준표를 선택해야 합니다. 동일 연도 h5 충돌/복수 후보는 보류합니다.

conference-data.ts는 Crossref event 및 ConferenceInfo assertion에서 명칭·시작일·종료일을 읽습니다. 일반 book-chapter를 무조건 학술대회로 분류하지 않습니다. 학술대회의 자동 기준일은 개최 시작일뿐이며, 출판 날짜 후보는 편집창에서 별도 유지합니다. 실제 CSA 2024 논문의 공개 Crossref 필드 발췌는 tests/conference-crossref-fixture.json에 있습니다.

동일 제목 최신 병합 키는 저자+정규화 제목+학술유형입니다. 저널·학술대회·프리프린트·미확인은 서로 병합하지 않습니다. 동일 제목 학술대회 표시도 저자별로 구성하고 실제 버전 관계를 추론하지 않습니다. tests/recognition-conference.test.mjs는 공식 데이터 개수/스키마, SCIE 오판 방지, BK와 학회 권장 목록 분리, h5 49/50 경계, 수동값 보존, 자료 교체, 자동 내보내기, 실제 CSA 개최일, 기간 제외 및 유형별 중복 보존을 검증합니다.


SCIE coverage update (2026-09-16): criteria.ts includes four MJL-confirmed journals, with ISSN/eISSN and ISSN-specific official evidence links. Existing complete source defaults migrate once via sourceRevision; restricted choices remain unchanged. Reference matching uses a WeakMap index of normalized names/ISSNs for 30,000-row tables. reference-import.ts reads UTF-8 CSV/Excel TSV, prioritizes explicit SCIE index values over SCIE-only mode, rejects JIF-only inference, and deduplicates identical rows. Preset JSON imports allow 10MB. No subscription data is bundled or published. Missing coverage remains unknown; explicit negative evidence is never inferred from absence.

HCIS follow-up: supplemental-papers.ts supplies one audited KISTI-registered work absent from OpenAlex/Crossref on 2026-09-16. Association uses a verified author id or ORCID, never display-name similarity; conflicting ORCID fails closed. Its provenance and publisher date are explicit, and supplemental counts do not enter OpenAlex pagination totals. mergePaperSources deduplicates a supplemented DOI within an author and publication kind, preserving the existing edited copy. This is a bounded correction dataset, not a publisher harvesting service. HCIS ISSN 2192-1962 is verified SCIE in public Clarivate MJL; total built-in coverage is 175 journals.

Journal source adapters: src/lib/journal-search.ts validates ISSNs, queries Crossref by journal and author, converts candidates with explicit source/date provenance and deduplicates accepted candidates without overwriting existing edited rows. src/components/journal-search.tsx provides per-author candidate review and explicit per-source pagination/errors. journalSources is an optional favorites payload field for backward compatibility and is also a device-local preference. Accepted journal rows survive a fresh OpenAlex query and remain subject to applied date filters.

HCIS author discovery is now live via the existing public metadata API /api/journal-search, implemented in services/publication-date/journals.mjs. The allowlisted server reads the publisher's s_author form field; no DOI is needed as input. The earlier single audited supplement remains a bounded fallback, while this new source can find other papers dynamically. See the service README for limits and deployment. Journal registration is independent of recognition evidence; no SCIE status is inferred from registration.

Automatic journal discovery: loadPapers calls discoverJournalCandidates on a fresh load after OpenAlex retrieval, including when OpenAlex fails. Each enabled journal/author receives one first-page query; identical normalized queries share a request without merging identities. Provider 429 stops new queries to that provider. JournalResult keeps author/query/range snapshots, source errors, pagination and month-excluded candidates. Candidates never enter the ledger/exports until explicitly selected; existing DOI rows stay disabled in review. Subsequent OpenAlex pagination does not repeat journal discovery. tests/hcis-author-results.json is a metadata-only public source fixture; discovery tests cover the reported OOD title, normalized names, disabled sources, per-author identity separation, month exclusions, provider failure/429 and stale-run suppression.

Date-basis policy (2026-09-17): publication-dates.ts now chooses the meaning of the date before ranking sources. preferredDate defaults to issue, supports online, and falls back to the other kind only if the preferred kind is absent; generic publication metadata is the final fallback with an explicit unspecified-kind label. Crossref issued/published are never treated as issue dates. Source reliability only ranks candidates within a kind. Publisher metadata is online only when citation_online_date is explicit; generic Published on is not issue evidence. HCIS rows and the audited HCIS registry entry were relabeled as unspecified publisher metadata without changing dates. Year-only preferred dates retain their precision. Manual exceptions survive, with a visible exception label. Conference event dates are unchanged.

withDateBasis is applied before recognition, range filtering, latest-title grouping, sorting and export. Raw candidates remain available. JournalResult retains included/excluded candidates, and rebaseJournalResult recalculates membership on setting changes without re-fetching. Original issue/online date columns and applied-policy column are available to custom layouts and chronological sorting. layoutSchema and favoritePayloadSchema default old data to issue; local preference and saved presets/favorites persist the setting. No Google permission or backend changes. tests/date-basis.test.mjs covers hybrid/single/unspecified dates, metadata arrival order, partial precision, manual exceptions, conference invariance, range changes, CSV and reopened XLSX, schema migration and candidate rebasing.
