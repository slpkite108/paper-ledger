# 논문대장

여러 저자의 논문을 모아 사용자 양식으로 정리하고 Excel로 내보내는 웹 앱입니다.

**[웹 앱 열기](https://slpkite108.github.io/paper-ledger/)** · [사용 안내](documentation/USER_GUIDE.md) · [개발·배포 안내](documentation/DEVELOPMENT.md)

## 주요 기능

- 시작·종료 연월 범위, 월 미상 포함 선택, 조회 조건 즐겨찾기
- 등록 저널 자동 검색: 기본 논문 조회와 함께 HCIS·Crossref 저널을 조회하고, 저자별 후보 확인 후 대장 합치기
- 여러 저자 검색·즐겨찾기, 저널/학술대회 구분, arXiv 제외, 같은 제목·같은 유형 최신 논문 선택 (학술대회·저널 각각 유지)
- 최대 3개 기준 정렬, 사용자 열·데이터 매칭·서식 프리셋, Excel 머리글 붙여넣기
- 서식을 유지하는 XLSX와 CSV 다운로드
- Tech Science Press DOI 출판사 날짜 자동 보완, 출판일 근거 비교·재확인, 월 미상 처리, Cite(RIS/BibTeX/HTML) 날짜 가져오기
- Google 계정의 앱 전용 저장소에 즐겨찾기·프리셋·개인 API 키 저장
- 같은 탭에서 새로고침 후 Google 연결 복원, 상단의 계정·연결 상태 표시
- SCIE·CS우수학술대회·h5 기준표 자동 대조와 출처 기록 (학회 권장 목록은 BK 판정 제외)

학술대회는 Crossref 행사·ConferenceInfo의 개최 시작일을 기준으로 표시·정렬합니다. SCIE 내장 범위는 IEEE 167종·출판사 확인 3종·Clarivate 개별 확인 5종이며, h5는 확인한 기준표를 추가해야 합니다. 자세한 범위는 [사용 안내](documentation/USER_GUIDE.md)에 있습니다.

## 로컬 실행

Node.js 22.13 이상에서 실행합니다.

```sh
npm ci
npm run dev
```

## 확인과 배포 파일 생성

```sh
npm run check
npm test
npm run build
npm run preview
```

GitHub Pages는 **main 브랜치의 /docs 폴더**를 배포합니다. 소스 수정 후 빌드한 docs/도 함께 커밋하세요.

## 저장소 구성

| 경로 | 내용 |
| --- | --- |
| src/app/ | 화면과 공통 스타일 |
| src/components/ | 기능별 화면 및 UI 컴포넌트 |
| src/lib/ | 검색·정렬·프리셋·Google 저장·인정 기준 로직 |
| src/vendor/ | 사용 중인 UI 스타일 파일 |
| services/publication-date/ | DOI 출판사 날짜 조회 API (별도 배포) |
| public/ | 설정·개인정보 안내·아이콘 원본 |
| docs/ | GitHub Pages에 배포하는 빌드 결과 |
| documentation/ | 사용 및 개발 안내 |
| build.mjs | 단일 HTML 배포 파일 생성 |

## 데이터 저장

Google의 단기 로그인 토큰은 만료 시점까지 이 탭의 sessionStorage에 보관해 새로고침 후 연결을 복원합니다. 복원 시 Google에서 계정을 다시 확인하며, 연결 종료·만료·인증 거부 시 저장된 토큰을 삭제합니다. 브라우저의 탭 복원 기능에 따라 세션이 복원될 수 있으므로 공용 기기에서는 연결 종료를 사용하세요. 토큰은 localStorage에 보관하지 않으며 자동 갱신하지 않습니다. 사용 중인 OpenAlex 키는 메모리에만 유지하고, 새로고침 후 Google에 저장된 키를 다시 불러옵니다.

Google에 저장한 데이터는 해당 계정의 앱 전용 저장소를 사용합니다. 프리셋은 논문 행을 저장하지 않으므로 편집 결과는 Excel/CSV로 보관하세요. API 키·클라이언트 비밀값·토큰은 저장소에 넣지 마세요.

인정 기준 자료는 조사일과 자료판을 표시합니다. 목록 일치는 검토 후보이며 기관의 최종 인정 판단을 대신하지 않습니다. [기준 자료와 적용 범위](documentation/USER_GUIDE.md#인정-기준-자료-조사일-2026-09-16)

저널 출판일은 권·호 발행일 우선 / 온라인 게재일 우선 중 선택합니다. 하나만 확인되면 그 날짜를 사용하며, 대체 적용·종류 미확인·직접 지정 예외를 표시합니다. 같은 기준을 기간·정렬·내보내기에 적용하고 즐겨찾기·양식 프리셋에 보관합니다.
