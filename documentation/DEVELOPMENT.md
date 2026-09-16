# 개발·배포 안내

## 실행 구조

React + TypeScript + Vite 정적 앱입니다. 별도 서버 없이 OpenAlex와 Crossref를 호출하고, Google Identity Services와 Drive 앱 전용 저장소를 사용합니다. 개발 진입점은 src/main.tsx이며 @ 별칭은 src/를 가리킵니다.

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
- 중복·유형 필터: publications.ts
- 사용자 양식·다중 정렬·Excel: layouts.ts, ledger-export.ts
- Google 저장: google-store.ts
- 인정 기준: criteria.ts, recognition.ts, bk-cs-data.json

인정 자료를 갱신할 때 출처·자료판·조사일과 자동 대조 범위를 사용 안내에 같이 기록하세요. 발표 트랙 또는 기관 기준이 다르면 최종 인정 결과가 달라질 수 있습니다.

출판일 검증은 tests/publication-date.test.mjs에서 실제 오류 논문의 공개 메타데이터 fixture, 연도만 있는 날짜, 인쇄/온라인 날짜 차이, 잘못된 날짜, 사용자 지정값 보존, 정렬·CSV, DOI가 일치하는 인용정보와 CORS 실패 안내를 확인합니다. fixture는 2026-09-16 조회한 공개 서지정보의 발췌이며 원문 전체를 포함하지 않습니다. 출판사 수동 확인 목록은 DOI 완전 일치로만 적용합니다. 목록에 없는 논문의 월을 임의로 채우지 마세요.

GitHub Pages는 정적 호스팅이므로 CORS를 허용하지 않는 출판사를 브라우저에서 자동 수집할 수 없습니다. 출처 URL 직접 조회는 공개 요청(credentials omit)이며 실패 시 파일/붙여넣기 경로를 제공합니다. 무조건적인 외부 프록시나 CORS 우회 서비스는 사용하지 않습니다. 서지 보완은 DOI별 2개 동시 요청과 기존 upstream 캐시/요청 제한 처리를 사용합니다.
