# 논문대장

여러 저자의 논문을 검색하고 17개 연구실적 항목으로 정리하는 정적 웹 앱입니다.

웹 앱: https://slpkite108.github.io/paper-ledger/

## 사용

1. 저자 이름·ORCID·OpenAlex ID를 검색하고 여러 저자를 선택합니다.
2. 참여교수 표기명과 연도를 정한 뒤 논문을 불러옵니다.
3. arXiv 제외(기본 꺼짐), 같은 제목 최신 1편(기본 켜짐), 학술유형 필터를 사용합니다.
4. 저자 즐겨찾기에 목록과 조회 조건을 저장합니다. Google 미연결 시 해당 브라우저에 저장합니다.
5. 논문명을 눌러 수정하고, 선택한 행을 17열 CSV로 내보냅니다.

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
4. 승인된 JavaScript 원본에 **https://slpkite108.github.io**를 등록합니다. /paper-ledger 경로는 넣지 않습니다.
5. 권한은 openid, email, profile, https://www.googleapis.com/auth/drive.appdata 를 사용합니다. 테스트 중이면 사용할 Google 계정을 테스트 사용자로 등록합니다.
6. 공개 클라이언트 ID(...apps.googleusercontent.com)를 config.js의 googleClientId에 넣어 커밋합니다. 비밀값은 넣지 않습니다. 임시로 검색 설정의 앱 설정에서 본인 브라우저에만 적용할 수도 있습니다.
7. 개인정보처리방침 주소가 필요하면 https://slpkite108.github.io/paper-ledger/privacy.html 을 사용합니다. 운영자 지원 이메일 등 Google Cloud에 제출하는 정보는 운영자가 확인해야 합니다. 공개 사용 시 Google의 검증·도메인 관련 요구사항을 따라야 합니다.
8. 앱에서 Google 계정으로 연결하고 앱 전용 저장 권한을 허용합니다. 실제 로그인·권한 동의는 사용자가 진행합니다.

Google 연결 후 즐겨찾기는 각 사용자의 Drive 앱 전용 저장소에 저장됩니다. ‘Google에 저장’을 누른 개인 키만 같은 저장소에 저장하며, 재연결할 때 이 탭의 메모리로 읽어 사용합니다. Google 접근 제어와 HTTPS를 사용하며 앱 자체의 별도 비밀번호 암호화는 없습니다. 토큰은 메모리에만 유지합니다. 새로고침·만료 후에는 다시 연결해야 합니다. 저장된 키와 즐겨찾기는 앱에서 각각 삭제할 수 있습니다. 브라우저 즐겨찾기를 자동으로 Google에 복사하지 않으며, 원하는 목록을 불러온 뒤 Google 연결 후 새로 저장하면 됩니다.

Google 문서: https://developers.google.com/identity/oauth2/web/guides/use-token-model
Drive 앱 데이터: https://developers.google.com/workspace/drive/api/guides/appdata

## 배포

index.html, config.js, privacy.html, .nojekyll을 저장소 루트에 둡니다. Settings → Pages → Deploy from a branch → main / (root) → Save.
정적 앱이므로 서버나 결제 정보가 필요하지 않습니다. OpenAlex와 Crossref 조회에는 인터넷이 필요하고 각 서비스의 사용 한도가 적용됩니다.
소스는 source.zip에 있으며 압축 해제 후 Node.js 22.13 이상에서 npm install, npm run build로 HTML을 다시 만들 수 있습니다.

## 데이터

API 키, 로그인 토큰, 사용자 정보는 GitHub에 업로드하지 않습니다. 논문 편집 내용은 탭 안에서만 유지하므로 CSV로 저장하세요. SCIE·BK·IF 등의 인정 여부는 기관 기준과 원문으로 직접 확인해야 합니다.
