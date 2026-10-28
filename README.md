# 에어컨탐정 홈페이지

대전·세종·충청권 에어컨 분해청소·수리·설치 홈페이지입니다. 단정 오피스케어와 같은 Supabase를 쓰고, 테이블만 따로(`ac_posts`, `ac_quotes`) 씁니다.

## 들어 있는 것
- `index.html` : 홈페이지 전체 화면 (메인, 사건 기록, 글 보기, 글쓰기, 견적 의뢰서, 관리자)
- `api/` : 서버 기능 (관리자 로그인, 사건 기록 저장, 사진 올리기, 견적 의뢰 + 문자 알림, 검색엔진용 글 페이지, 사이트맵)
- `supabase.sql` : Supabase에 한 번 실행할 설정
- `img/` : 첫 화면 이미지, 캐릭터 이미지

## 처음 한 번 설정
1. **Supabase** → SQL Editor에 `supabase.sql` 내용을 붙여넣고 Run
2. **GitHub** 새 저장소 `aircon-detective` 만들고 이 폴더 안의 파일을 전부 올리기
3. **Vercel** → Add New → Project → 그 저장소 Import
4. Vercel 프로젝트 Settings → Environment Variables에 아래 값 넣기 (단정 프로젝트와 같은 값을 복사)
   - `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
   - `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SMS_FROM`, `SMS_TO`
   - `ADMIN_PASSWORD` : 에어컨탐정 관리자 비밀번호 (새로 정해도 됨)
5. 환경변수를 넣은 뒤 Deployments → 맨 위 배포 → Redeploy

## 쓰는 법
- 관리자: 사이트 맨 아래 `관리자` → 비밀번호 → 견적 의뢰 확인, 사건 기록 쓰기
- 카카오톡 버튼: `index.html`의 `const KAKAO_URL = '';` 따옴표 안에 카톡 채널 주소를 넣으면 오른쪽 아래에 카톡 버튼이 생깁니다.
- 네이버 서치어드바이저에 `https://(주소)/sitemap-cases.xml` 제출. 주소가 `aircon-detective.vercel.app`가 아니면 `robots.txt`, `index.html`의 canonical 주소도 바꿔 주세요.
