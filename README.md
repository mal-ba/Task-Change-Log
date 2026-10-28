# ScopeLog · 작업 변경 기록

프리랜서(웹 제작자, 디자이너, 영상 편집자 등)를 위한 **작업 변경 기록 도구**입니다.
처음 약속한 작업과 나중에 추가된 작업을 분리해 기록하고, 고객과 함께 확인할 수 있게 해줍니다.

> 예) 20만 원에 홈페이지 제작 — 최초 계약: 페이지 3개, 수정 2회, 납기 7일
> → 고객이 "페이지 2개 추가"를 요청하면 추가 요청으로 기록하고 비용·납기를 협의
> → 기존 작업과 추가 작업을 분리한 변경 내역서를 PDF나 링크로 공유

## MVP 기능

| # | 기능 | 위치 |
|---|------|------|
| 1 | 프로젝트별 최초 작업 범위·가격 등록 (작업 항목, 포함 수정 횟수, 납기) | 새 프로젝트 / 프로젝트 상세 |
| 2 | 추가 요청의 내용·날짜·예상 비용·납기 변경 기록, 승인/거절 처리 | 프로젝트 상세 › 추가·변경 요청 기록 |
| 3 | 변경 전후 내역을 PDF로 출력 | 프로젝트 상세 › 변경 내역서 (PDF) |
| 4 | 고객이 링크로 변경 내역 확인 (로그인 불필요) | 프로젝트 상세 › 고객 확인 링크 |
| 5 | 프로젝트 목록과 진행 상태 관리 | 홈, 프로젝트 |

추가로 들어간 것:
- 홈 대시보드: 진행 중 프로젝트, 이번 달 추가 확보 금액, 승인 대기 요청, **확인이 필요해요** 알림, 최근 활동
- 포함 수정 횟수 초과 경고 → 버튼 한 번으로 추가 요청에 기록
- 고객 관리, JSON 백업/복원, 샘플 데이터

## 실행 방법

빌드나 설치가 필요 없는 순수 HTML/CSS/JavaScript입니다.

```bash
# 저장소 폴더에서
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

`index.html`을 더블클릭해서 열어도 동작하지만, **고객 확인 링크**는 배포된 주소에서 만들어야 다른 사람이 열 수 있습니다.

## 무료 배포 (GitHub Pages)

1. GitHub 저장소 → **Settings → Pages**
2. Source: **Deploy from a branch**, 브랜치 선택, 폴더 `/ (root)` → Save
3. 잠시 후 `https://<아이디>.github.io/<저장소>/` 주소로 접속

Netlify, Cloudflare Pages, Vercel에 폴더를 그대로 올려도 됩니다. 비용은 0원입니다.

## 로그인 설정 (Supabase)

`js/config.js`가 비어 있으면 로그인 없이 브라우저에만 저장하는 모드로 동작합니다.
아래처럼 Supabase를 연결하면 로그인 화면이 나타나고, 데이터가 계정에 저장되어 여러 기기에서 같은 내용을 볼 수 있습니다.

1. https://supabase.com 에서 새 프로젝트를 만듭니다. 지역은 **Northeast Asia (Seoul)**을 추천합니다.
2. **SQL Editor**에 [`supabase/schema.sql`](supabase/schema.sql) 내용을 붙여넣고 **Run**을 누릅니다.
3. **Project Settings → API**에서 `Project URL`과 `anon public` 키를 복사해 `js/config.js`에 넣습니다.
4. **Authentication → URL Configuration**
   - Site URL: `https://scopelog.onrender.com`
   - Redirect URLs: `https://scopelog.onrender.com/**` (로컬 테스트용으로 `http://localhost:8000/**`도 추가)
5. (선택) **Authentication → Providers**에서 소셜 로그인을 켜고 `js/config.js`의 `providers`를 `true`로 바꿉니다.
   - **Google**: Google Cloud Console에서 OAuth 클라이언트(웹)를 만들고, 승인된 리디렉션 URI에 Supabase가 보여주는 Callback URL을 넣습니다.
   - **Kakao**: Kakao Developers에서 앱을 만들고 REST API 키와 Client Secret을 Supabase에 넣습니다. Redirect URI에 Supabase Callback URL을 등록합니다.
     이메일 동의 항목은 비즈니스 인증이 필요할 수 있으니, Supabase Kakao 설정의 이메일 없는 사용자 허용 옵션을 확인하세요.
   - **네이버**는 Supabase 기본 지원 목록에 없어 별도 서버 기능이 필요합니다. (다음 단계)

로그인 전에 이 브라우저에서 쓰던 데이터가 있으면 첫 로그인 때 계정으로 옮길지 물어봅니다.

## 데이터 저장 방식과 한계 (MVP)

- 로그인하지 않는 모드에서는 **사용하는 브라우저의 localStorage**에만 저장됩니다.
  브라우저 기록을 지우거나 기기를 바꾸기 전에 **설정 › 백업 파일 다운로드**를 해 주세요.
- 로그인 모드에서는 사용자마다 전체 데이터를 Supabase `app_state` 테이블 한 줄(JSON)로 저장하고, RLS로 본인 데이터만 접근할 수 있습니다.
  두 기기에서 동시에 수정하면 나중에 저장한 쪽이 남습니다.
- 고객 확인 링크는 내역서 내용을 압축해서 URL(`#` 뒤)에 담는 방식입니다. 서버가 없어도 되지만
  링크를 만든 시점의 내용이 담기므로, 내용이 바뀌면 링크를 새로 보내야 합니다.
  `#` 뒤 데이터는 서버로 전송되지 않습니다.
- 고객이 링크에서 직접 "승인" 버튼을 누르는 기능은 서버(DB)가 필요하므로 다음 단계입니다.
  지금은 고객 동의를 받은 뒤 작업자가 승인으로 기록합니다.

## 다음 단계 아이디어

- 네이버 로그인
- 고객이 링크에서 직접 승인/거절, 승인 시각 기록
- 무료(프로젝트 2개) / 개인 / 전문가 요금제 제한

## 파일 구조

```
index.html        진입점
css/style.css     스타일 (인쇄용 스타일 포함)
js/icons.js       SVG 아이콘
js/config.js      Supabase 연결 설정
js/utils.js       포맷·날짜·금액 계산
js/cloud.js       로그인·서버 동기화 (Supabase)
js/store.js       데이터 저장 (localStorage), 샘플 데이터
js/report.js      변경 내역서 HTML, 공유 링크 인코딩
js/views.js       화면 렌더링
js/app.js         라우터, 모달, 이벤트 처리
supabase/schema.sql  DB 테이블·보안 정책
```
