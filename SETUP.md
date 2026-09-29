# 팀장 초기 세팅 가이드

> README 4-2의 체크리스트를 **순서대로 따라 하면 되는** 상세 가이드입니다.
> 팀장(또는 세팅 담당자) 1명이 **한 번만** 하면 됩니다. 다른 팀원은 README 5장만 보면 됩니다.
> GitHub·Supabase·카카오 화면의 메뉴 이름은 업데이트로 조금 바뀔 수 있습니다.

## 목차
1. [GitHub 저장소 만들기](#1-github-저장소-만들기)
2. [프로젝트 뼈대 만들기](#2-프로젝트-뼈대-만들기)
3. [.gitignore 작성](#3-gitignore-작성)
4. [ESLint + Prettier 설정](#4-eslint--prettier-설정)
5. [.env.example 작성](#5-envexample-작성)
6. [Issue / PR 템플릿 추가](#6-issue--pr-템플릿-추가)
7. [첫 push와 develop 브랜치](#7-첫-push와-develop-브랜치)
8. [브랜치 보호 규칙](#8-브랜치-보호-규칙)
9. [Supabase 프로젝트 만들기](#9-supabase-프로젝트-만들기)
10. [소셜 로그인 (카카오·구글)](#10-소셜-로그인-카카오구글)
11. [Storage 버킷 만들기](#11-storage-버킷-만들기)
12. [DB 스키마 작성과 RLS](#12-db-스키마-작성과-rls)
13. [더미 데이터 (seed)](#13-더미-데이터-seed)
14. [팀원에게 공유할 것](#14-팀원에게-공유할-것)

---

## 1. GitHub 저장소 만들기

1. GitHub 오른쪽 위 **+ → New organization** (무료 플랜) → 이름 예: `jje-team`
2. Organization 안에서 **New repository** → 이름 `goodzpick`
   - **Add a README file: 체크 해제** (README는 우리가 만든 걸 올립니다)
   - .gitignore, license: None
3. **Settings → Collaborators and teams (또는 People) → Invite member**로 팀원 4명 초대
4. 팀원은 메일에서 초대 수락

> 브랜치 보호 규칙(8번)은 **Public 저장소**에서는 무료입니다. Private으로 만들면 무료 플랜에서는 적용이 안 될 수 있어서, Private이 꼭 필요하면 GitHub Student Developer Pack(학생 무료 Pro) 등을 확인하세요.

---

## 2. 프로젝트 뼈대 만들기

내 컴퓨터에서 원하는 위치에 폴더를 만들고 터미널에서 실행합니다.

```bash
mkdir goodzpick && cd goodzpick
git init
echo 24 > .nvmrc                # Node 버전 고정

# 프론트엔드
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-router-dom @tanstack/react-query zustand axios @supabase/supabase-js
npm install -D prettier
cd ..

# 백엔드
mkdir backend && cd backend
npm init -y
npm install express cors dotenv @supabase/supabase-js node-cron
npm install -D nodemon eslint @eslint/js globals prettier
mkdir -p src/routes src/controllers src/services src/middlewares src/jobs src/utils src/lib supabase
cd ..
```

**backend/package.json** 을 열어 아래처럼 수정합니다. (`"type"`과 `"scripts"` 부분)

```json
{
  "name": "backend",
  "type": "module",
  "scripts": {
    "dev": "nodemon src/app.js",
    "start": "node src/app.js",
    "lint": "eslint .",
    "format": "prettier --write ."
  }
}
```
(`dependencies`, `devDependencies`는 설치하면서 자동으로 들어간 그대로 둡니다.)

**frontend/package.json** 의 `"scripts"`에는 한 줄만 추가합니다. (`dev`, `build`, `lint`는 Vite가 이미 만들어 둠)

```json
"format": "prettier --write ."
```

**backend/src/app.js** (서버가 켜지는지 확인용 최소 코드)

```js
import express from 'express';
import cors from 'cors';
import 'dotenv/config';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());

app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' }, message: null });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API 서버 실행: http://localhost:${PORT}`));
```

**backend/src/lib/supabase.js**

```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

**frontend/src/lib/supabase.js** (로그인 전용)

```js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

**frontend/index.html** 의 viewport 줄에 `viewport-fit=cover`를 추가합니다.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

---

## 3. .gitignore 작성

저장소 맨 위(`goodzpick/.gitignore`)에 만듭니다. **GitHub에 올리면 안 되는 파일 목록**입니다.

```gitignore
# 패키지 (npm install로 다시 받을 수 있음)
node_modules/

# 빌드 결과
dist/

# 비밀 키 — 절대 올리지 않음
.env
.env.local

# OS·에디터 잡파일
.DS_Store
Thumbs.db
*.log
```

> `.env.example`은 올립니다. `.env`만 막습니다.

---

## 4. ESLint + Prettier 설정

**목적**: 5명의 코드 모양(따옴표, 들여쓰기)과 실수 검사 규칙을 똑같이 맞춥니다.

### 4-1. 저장소 맨 위에 공통 파일 3개

**`goodzpick/.prettierrc`** — 코드 모양 규칙

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "es5"
}
```

| 설정 | 의미 |
|---|---|
| `semi: true` | 문장 끝에 `;` 붙이기 |
| `singleQuote: true` | 문자열은 `'작은따옴표'` |
| `tabWidth: 2` | 들여쓰기 2칸 |
| `printWidth: 100` | 한 줄 100자 넘으면 줄바꿈 |
| `trailingComma: "es5"` | 배열·객체 마지막 항목 뒤에 `,` |

**`goodzpick/.prettierignore`** — 정리하지 않을 폴더

```
node_modules
dist
package-lock.json
```

**`goodzpick/.vscode/settings.json`** — VS Code에서 저장하면 자동 정리

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

**`goodzpick/.vscode/extensions.json`** — 팀원이 폴더를 열면 확장 설치를 추천해 줌

```json
{
  "recommendations": ["esbenp.prettier-vscode", "dbaeumer.vscode-eslint"]
}
```

### 4-2. frontend ESLint

Vite가 `frontend/eslint.config.js`를 **자동으로 만들어 두었으므로 그대로 사용**합니다.

### 4-3. backend ESLint

**`backend/eslint.config.js`** 를 새로 만듭니다.

```js
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { globals: globals.node },
    rules: {
      'no-unused-vars': 'warn',
    },
  },
];
```

### 4-4. 확인

```bash
cd frontend && npm run lint && npm run format
cd ../backend && npm run lint && npm run format
```
에러 없이 끝나면 성공입니다.

---

## 5. .env.example 작성

**`.env`** 는 실제 비밀 키가 들어가는 파일이라 GitHub에 올리지 않습니다.
**`.env.example`** 은 "어떤 키가 필요한지 이름만 적은 견본"이라 GitHub에 올립니다.
팀원은 이 견본을 복사해 `.env`를 만들고 값을 채웁니다.

**`backend/.env.example`** — 값은 비워 둡니다

```
# 서버 포트
PORT=4000

# Supabase 대시보드 > Project Settings > API 에서 복사
SUPABASE_URL=
# 같은 화면의 service_role 키 (서버 전용, 절대 공개 금지)
SUPABASE_SERVICE_ROLE_KEY=

# 프론트엔드 주소 (CORS 허용용)
CLIENT_URL=http://localhost:5173
```

**`frontend/.env.example`**

```
# 백엔드 API 주소
VITE_API_BASE_URL=http://localhost:4000/api/v1

# Supabase 대시보드 > Project Settings > API 에서 복사
VITE_SUPABASE_URL=
# 같은 화면의 anon (public) 키
VITE_SUPABASE_ANON_KEY=
```

**실제 값 공유 방법**: 팀장이 값을 채운 `.env` 내용을 **노션 비공개 페이지** 또는 팀 단톡에 공유합니다. GitHub·공개 노션에는 절대 올리지 않습니다.

---

## 6. Issue / PR 템플릿 추가

템플릿을 만들어 두면 이슈·PR을 만들 때 **양식이 자동으로 채워져서** 모두 같은 형식으로 씁니다.

### 6-1. 폴더 구조

```
goodzpick/.github/
├── ISSUE_TEMPLATE/
│   ├── feature.md
│   └── bug.md
└── pull_request_template.md
```

### 6-2. `.github/ISSUE_TEMPLATE/feature.md` (기능 개발)

```markdown
---
name: 기능 개발
about: 새 기능 작업을 등록합니다
title: "[feat] "
labels: feature
---

## 탭
<!-- 홈 / 굿즈샵 / 카테고리 / 찜 / 마이 / 공통 -->

## 작업 내용
- [ ]
- [ ]

## 참고 (노션, 디자인 링크)
```

### 6-3. `.github/ISSUE_TEMPLATE/bug.md` (버그)

```markdown
---
name: 버그 제보
about: 버그를 등록합니다
title: "[bug] "
labels: bug
---

## 어떤 문제인가요?

## 재현 방법
1.
2.

## 기대한 결과

## 스크린샷
```

### 6-4. `.github/pull_request_template.md`

```markdown
## 관련 이슈
close #

## 작업 내용
-

## 영향 받는 탭
<!-- 공통 컴포넌트(components/)를 수정했다면 꼭 적어 주세요 -->

## 스크린샷 (화면 변경 시)

## 체크리스트
- [ ] `npm run lint` 통과
- [ ] 로컬에서 실행 확인
- [ ] `.env` 파일을 올리지 않았음
```

> `close #12`처럼 적으면 PR이 머지될 때 12번 이슈가 자동으로 닫힙니다.

---

## 7. 첫 push와 develop 브랜치

```bash
cd goodzpick
git add .
git commit -m "chore: 프로젝트 초기 세팅"
git branch -M main
git remote add origin https://github.com/<org>/goodzpick.git
git push -u origin main

# develop 브랜치 만들어 올리기
git checkout -b develop
git push -u origin develop
```

GitHub 저장소 **Settings → General → Default branch**를 `develop`으로 바꿉니다. (PR이 기본으로 develop을 향하게)

---

## 8. 브랜치 보호 규칙

실수로 `main`·`develop`에 바로 push하는 것을 막고, PR + 리뷰를 거치게 합니다.

1. 저장소 **Settings → Branches → Add branch protection rule** (화면에 따라 **Rulesets → New ruleset**)
2. **Branch name pattern**: `main` 입력
3. 체크할 항목
   - ✅ **Require a pull request before merging**
   - ✅ **Require approvals** → `1`
4. **Create / Save**
5. 같은 방법으로 `develop`도 한 번 더 추가

---

## 9. Supabase 프로젝트 만들기

1. [supabase.com](https://supabase.com) 가입 → **New organization** (Free)
2. **New project**
   - Name: `goodzpick`
   - Database Password: 강하게 만들고 **따로 안전하게 보관** (팀 비공개 노션)
   - Region: **Northeast Asia (Seoul)**
3. 생성 완료 후 **Project Settings → API**에서 아래 3개를 복사해 두기 (5번 `.env`에 사용)
   - Project URL → `SUPABASE_URL`, `VITE_SUPABASE_URL`
   - `anon` public 키 → `VITE_SUPABASE_ANON_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (**서버 전용**)
4. **Organization Settings → Team → Invite**로 팀원 초대 (Developer 권한)

---

## 10. 소셜 로그인 (카카오·구글)

### 10-1. 공통: 콜백 주소 확인

Supabase **Authentication → Sign In / Providers**에서 카카오를 열면 **Callback URL**이 보입니다.
`https://<프로젝트ID>.supabase.co/auth/v1/callback` 형태이며, 아래 카카오·구글 설정에 그대로 붙여 넣습니다.

그리고 **Authentication → URL Configuration**에서
- Site URL: `http://localhost:5173`
- Redirect URLs: `http://localhost:5173/**` 추가 (배포 후엔 배포 주소도 추가)

### 10-2. 카카오

1. [developers.kakao.com](https://developers.kakao.com) 로그인 → **내 애플리케이션 → 애플리케이션 추가** (앱 이름: 굿즈픽)
2. **앱 키**의 **REST API 키** 복사 → Supabase 카카오 설정의 **Client ID(REST API Key)**
3. **카카오 로그인 → 활성화 ON**
4. **카카오 로그인 → Redirect URI**에 10-1의 Callback URL 등록
5. **보안 → Client Secret 코드 생성 → 활성화** → Supabase의 **Client Secret**에 입력
6. **동의항목**: 닉네임, 프로필 사진 설정 (이메일은 비즈 앱 전환이 필요할 수 있음)
7. Supabase에서 Kakao **Enable** → Save

### 10-3. 구글

1. [console.cloud.google.com](https://console.cloud.google.com) → 새 프로젝트 `goodzpick`
2. **API 및 서비스 → OAuth 동의 화면** 설정 (외부, 앱 이름·이메일만 입력)
3. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 리디렉션 URI: 10-1의 Callback URL
4. 생성된 **클라이언트 ID / 보안 비밀**을 Supabase Google 설정에 입력 → **Enable** → Save

> 카카오·구글 키는 Supabase 대시보드에만 넣습니다. `.env`에는 넣지 않습니다.

---

## 11. Storage 버킷 만들기

Supabase **Storage → New bucket**을 3번 반복합니다.

| 버킷 이름 | Public | 용도 |
|---|---|---|
| `products` | ✅ ON | 상품 이미지 |
| `shops` | ✅ ON | 굿즈샵 대표 이미지 |
| `banners` | ✅ ON | 홈 배너 이미지 |

Public이면 이미지 주소만 알면 누구나 볼 수 있어서 `<img src>`에 바로 쓸 수 있습니다. 업로드는 서버(service_role 키)만 합니다.

---

## 12. DB 스키마 작성과 RLS

**DB 스키마** = 테이블 설계도 (테이블 이름, 컬럼 이름·형식, 테이블끼리 연결)

### 12-1. 순서

1. 탭별 담당자가 노션에 **자기 탭에 필요한 테이블·컬럼**을 정리 (홈은 `홈탭-기획정리.md` 3장)
2. 팀 회의에서 **공통 테이블**(`users`, `products`, `shops`, `shop_inventories`, `categories` 등) 컬럼 이름 합의
3. 팀장이 합의 내용을 `backend/supabase/schema.sql`에 SQL로 작성
4. Supabase **SQL Editor → New query**에 붙여 넣고 **Run**
5. `schema.sql`을 GitHub에 커밋 (나중에 바뀐 이력을 볼 수 있게)

### 12-2. 작성 예시 (`backend/supabase/schema.sql`)

```sql
-- 검색용 확장 (한글 부분 검색)
create extension if not exists pg_trgm;

create table categories (
  id bigint generated always as identity primary key,
  name varchar(50) not null,
  type text not null check (type in ('CONTENT', 'GOODS')),
  sort_order int default 0,
  is_home_shortcut boolean default false
);

create table banners (
  id bigint generated always as identity primary key,
  title varchar(100) not null,
  image_url varchar(500) not null,
  link_type text not null check (link_type in ('EVENT','PRODUCT','SHOP','CATEGORY','URL')),
  link_value varchar(500) not null,
  sort_order int default 0,
  start_at timestamptz not null,
  end_at timestamptz not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ... 나머지 테이블도 같은 방식으로 작성

-- RLS 켜기 (테이블마다 한 줄씩)
alter table categories enable row level security;
alter table banners enable row level security;
```

### 12-3. RLS를 켜는 이유

RLS를 켜고 정책을 따로 만들지 않으면, 프론트의 `anon` 키로는 테이블을 **읽을 수도 쓸 수도 없습니다.**
우리는 데이터를 전부 서버(`service_role` 키, RLS 무시)로 다루기 때문에 기능은 정상 동작하고, 프론트 키가 노출돼도 데이터가 안전합니다.

> 테이블을 만들 때마다 `enable row level security` 줄을 **꼭** 같이 실행합니다. Supabase 대시보드 **Table Editor**에서 RLS가 꺼진 테이블은 경고 표시가 뜹니다.

---

## 13. 더미 데이터 (seed)

개발·발표용 가짜 데이터입니다. `backend/supabase/seed.sql`에 작성하고 SQL Editor에서 실행합니다.

```sql
insert into categories (name, type, sort_order, is_home_shortcut) values
  ('애니메이션', 'CONTENT', 1, true),
  ('게임',       'CONTENT', 2, true),
  ('아이돌',     'CONTENT', 3, true),
  ('캐릭터',     'CONTENT', 4, true),
  ('피규어',     'GOODS',   5, true),
  ('포토카드',   'GOODS',   6, true),
  ('키링',       'GOODS',   7, true),
  ('아크릴 스탠드','GOODS', 8, true),
  ('인형',       'GOODS',   9, true),
  ('문구',       'GOODS',  10, false);

-- 굿즈샵, 상품, 재고도 탭 담당자가 나눠서 작성
```

---

## 14. 팀원에게 공유할 것

- [ ] GitHub 저장소 주소 (초대 수락 요청)
- [ ] Supabase 초대 수락 요청
- [ ] 채워진 `backend/.env`, `frontend/.env` 내용 (비공개 채널로)
- [ ] "README 5장대로 clone → npm install → npm run dev 해 보고, `http://localhost:4000/api/v1/health`에서 `ok` 나오는지 확인" 안내
