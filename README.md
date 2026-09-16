# 논문대장

여러 저자의 논문을 검색하고 사용자가 만든 양식으로 연구실적을 정리하는 정적 웹 앱입니다.

웹 앱: https://slpkite108.github.io/paper-ledger/

## 사용

1. 저자 이름·ORCID·OpenAlex ID를 검색하고 여러 저자를 선택합니다.
2. 참여교수 표기명과 연도를 정한 뒤 논문을 불러옵니다.
3. arXiv 제외(기본 꺼짐), 같은 제목 최신 1편(기본 켜짐), 학술유형 필터를 사용합니다.
4. 저자 즐겨찾기에 목록과 조회 조건을 저장합니다. Google 미연결 시 해당 브라우저에 저장합니다.
5. **양식·프리셋**에서 Excel 머리글을 붙여넣고, 열 이름·순서·데이터 연결·고정값·논문별 사용자 항목을 구성합니다. 기본 17항목도 불러올 수 있습니다.
6. 글자 크기·열 너비·셀 정렬·숫자/백분율/연월 형식·머리글 색·줄바꿈·교차 행 배경을 지정합니다. 최대 3개 기준으로 정렬하고 열 머리글로도 순서를 바꿀 수 있습니다. 빈 값은 오름/내림차순 모두 마지막입니다.
7. 프리셋에는 열·서식·정렬·선택한 인정 기준과 추가 기준표가 저장됩니다. Google 연결 시 Google Drive 앱 저장소에, 미연결 시 이 브라우저에 저장합니다. JSON 파일로 프리셋을 주고받을 수 있습니다. 기존 브라우저 프리셋은 연결 후 다시 저장하면 Google에 저장됩니다.
8. 논문명을 눌러 서지정보와 사용자 항목을 수정합니다. **내 양식 표**에서 결과를 확인하고 **Excel 다운로드**로 서식을 포함한 XLSX를 받습니다. CSV에는 값만 포함됩니다. 선택·표시된 행이 현재 정렬 순서로 내보내집니다.

## 인정 기준 자료 (조사일: 2026-09-16)

**인정 기준·자료 선택**에서 CS 자료를 우선 제공하며, 다른 분야·기관 자료도 선택하거나 Excel 표로 추가할 수 있습니다. 기본값은 CS BK21 목록입니다. ‘최신’은 이번 조사에서 확인한 공개 자료의 판을 뜻하며 실시간 갱신이 아닙니다.

- CS BK21: [한국과학기술한림원 2026-03-23 공식 공고](https://kast.or.kr/kr/notice/notice.php?bbs_data=aWR4PTIzNDE4JnN0YXJ0UGFnZT0wJmxpc3RObz00ODgmdGFibGU9JmNvZGU9bm90aWNlJnNlYXJjaF9pdGVtPSZzZWFyY2hfb3JkZXI9%7C%7C&bgu=view&cate=&code=notice&idx=23418)의 첨부 목록 188개와 인정 IF를 수록했습니다. **공고 연도가 목록의 개정연도라는 뜻은 아닙니다.** 최신 공고에서 재사용한 자료이며 제출 기관의 적용 범위를 확인해야 합니다.
- CS 한국정보과학회: [공식 우수학술대회 안내](https://aisociety.kr/sub/sub_04_02.php)에 게시된 2024 개편 목록(216개) 링크를 제공합니다. [2026-05-22 학회 공지](https://kmms.or.kr/board/news/article/276662)는 연구재단 공식 인정 논의 중이라고 설명합니다. 학회 우수 등급을 BK 인정으로 자동 대체하지 않습니다.
- SCIE: [Clarivate Master Journal List](https://mjl.clarivate.com/)에서 ISSN과 Science Citation Index Expanded 색인명·수록기간을 확인합니다. IF가 있다는 사실만으로 SCIE라고 판정하지 않습니다. 현재 수록 상태와 출판 당시 수록 상태는 다를 수 있습니다.
- h5-index: [Google Scholar Metrics 공식 안내](https://scholar.google.com/intl/en/scholar/metrics.html)에 표시된 2025년 7월판(2020–2024 발행 논문)을 기준으로 CS/전 분야 검색 링크를 제공합니다. h5는 학술지·학술대회 지표이며 저자 h-index와 다릅니다. 미수록을 50 미만으로 간주하지 않습니다.

기본 BK 목록과 사용자가 가져온 기준표는 ISSN 또는 정규화한 학술지명/약칭의 일치 후보를 표시합니다. 부분 약칭으로 추측하지 않습니다. 자동 일치가 없으면 기준표에서 직접 항목을 찾을 수 있습니다. 실제 발표 트랙, 워크숍 여부, 기관 적용 기준을 검토한 행만 체크하고 반영하세요. 모호하거나 자료가 없으면 미확인으로 남깁니다. 외부 서비스 전체의 실시간 SCIE/h5 조회는 연결되어 있지 않습니다.

다른 자료는 Excel에서 **학술지명 / ISSN / 약칭 / 구분 / 값 / 인정 IF** 머리글과 행을 복사하여 추가합니다. 이름·기준연도·공식 출처 URL이 필요합니다. 구분은 SCIE, BK인정, h5-index, 참고 중 하나이며 h5 값은 정수입니다. 최대 10개 기준표, 각 5,000행입니다. 자료 최신판 및 적용 범위는 사용자가 확인합니다.

논문 편집에서도 SCIE/BK 결과와 h5 값·기준연도·출처·메모를 기록할 수 있습니다. 양식에서 ‘SCIE 확인 결과’, ‘BK 확인 결과’, ‘학술지·학술대회 h5-index’, ‘인정 근거·기준연도’를 연결하면 내보내기에 포함됩니다.

## 학술유형·중복 처리

- 출처가 학술대회면 conference로 분류합니다. OpenAlex article만으로 저널이라고 단정하지 않습니다.
- DOI가 있는 미확인 자료는 Crossref를 확인합니다. ‘Crossref 학술유형 보완’은 불러온 DOI 문헌의 분류를 다시 확인합니다. 메타데이터가 없으면 미확인으로 남기며 직접 수정할 수 있습니다.
- 제목은 Unicode NFKC, 대소문자, 연속 공백을 정규화합니다. 같은 참여교수·같은 제목 중 최신 출판일 1편을 표시합니다. 날짜가 같으면 OpenAlex ID로 일정하게 결정합니다.
- 유형 필터를 먼저 적용한 뒤 중복을 합칩니다. 원본 조회 행을 삭제하지 않으므로 옵션을 끄면 다시 표시됩니다. 제목이 다르면 자동으로 합치지 않습니다.
- arXiv는 주 출처·DOI·원문 주소로 판단합니다. 학술지 게재본의 보조 arXiv 링크만으로 제외하지 않습니다.
- 필터는 현재까지 불러온 결과에 적용합니다. 페이지당 저자별 100편이며, 다음 논문 불러오기로 더 가져옵니다. CSV에는 현재 표시되고 선택된 행만 포함합니다.

## Google 계정 설정 (최초 1회 필요)

현재 config.js의 클라이언트 ID는 비어 있습니다. 실제 Google 로그인은 ID 발급 후 사용할 수 있습니다.

1. Google Cloud 프로젝트를 만들고 Google Auth Platform에서 앱 이름, 지원 이메일, 대상을 설정합니다.
2. **Google Drive API**를 같은 프로젝트에서 활성화합니다.
3. OAuth 클라이언트 유형을 **웹 애플리케이션**으로 만듭니다.
4. 승인된 JavaScript 원본에 [https://slpkite108.github.io](https://slpkite108.github.io) 주소를 등록합니다. /paper-ledger 경로는 넣지 않습니다.
5. 권한은 openid, email, profile, https://www.googleapis.com/auth/drive.appdata 를 사용합니다. 테스트 중이면 사용할 Google 계정을 테스트 사용자로 등록합니다.
6. 공개 클라이언트 ID(...apps.googleusercontent.com)를 config.js의 googleClientId에 넣어 커밋합니다. 비밀값은 넣지 않습니다. 임시로 검색 설정의 앱 설정에서 본인 브라우저에만 적용할 수도 있습니다.
7. 개인정보처리방침 주소가 필요하면 https://slpkite108.github.io/paper-ledger/privacy.html 을 사용합니다. 운영자 지원 이메일 등 Google Cloud에 제출하는 정보는 운영자가 확인해야 합니다. 공개 사용 시 Google의 검증·도메인 관련 요구사항을 따라야 합니다.
8. 앱에서 Google 계정으로 연결하고 앱 전용 저장 권한을 허용합니다. 실제 로그인·권한 동의는 사용자가 진행합니다.

Google 연결 후 즐겨찾기는 각 사용자의 Drive 앱 전용 저장소에 저장됩니다. ‘Google에 저장’을 누른 개인 키만 같은 저장소에 저장하며, 재연결할 때 이 탭의 메모리로 읽어 사용합니다. Google 접근 제어와 HTTPS를 사용하며 앱 자체의 별도 비밀번호 암호화는 없습니다. 토큰은 메모리에만 유지합니다. 새로고침·만료 후에는 다시 연결해야 합니다. 저장된 키·즐겨찾기·양식 프리셋은 앱에서 각각 삭제할 수 있습니다. 브라우저 즐겨찾기를 자동으로 Google에 복사하지 않으며, 원하는 목록을 불러온 뒤 Google 연결 후 새로 저장하면 됩니다.

Google 문서: https://developers.google.com/identity/oauth2/web/guides/use-token-model
Drive 앱 데이터: https://developers.google.com/workspace/drive/api/guides/appdata

## 배포

index.html, config.js, privacy.html, .nojekyll을 저장소 루트에 둡니다. Settings → Pages → Deploy from a branch → main / (root) → Save.
정적 앱이므로 서버나 결제 정보가 필요하지 않습니다. OpenAlex와 Crossref 조회에는 인터넷이 필요하고 각 서비스의 사용 한도가 적용됩니다.
소스는 source.zip에 있으며 압축 해제 후 Node.js 22.13 이상에서 npm install, npm run build로 HTML을 다시 만들 수 있습니다.

## 데이터

API 키, 로그인 토큰, 사용자 정보는 GitHub에 업로드하지 않습니다. 논문 편집 내용·검토 결과·사용자 입력값은 탭 안에서만 유지하므로 Excel/CSV로 저장하세요. 프리셋은 논문 행을 저장하지 않습니다. SCIE·BK·IF 등의 최종 인정 여부는 선택한 기준 자료와 기관 지침·원문을 대조하세요.
