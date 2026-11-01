# 2D 진열장 배포 및 확인

## 데이터베이스

공용 프로젝트에는 아직 적용하지 않은 `migrations/20261101000000_showcases.sql`을 검토한 뒤 대상 환경에 순서대로 적용한다. 기존 `users`, `stores`, `store_products`, `products`, `categories`, `product_categories` 구조는 2026-11-01에 읽기 전용 SQL로 확인했다. 로컬 환경에는 Supabase CLI가 설치되어 있지 않아 파일을 직접 작성했다. 이 SQL은 새 테이블 4개, 저장 RPC, 소유/상품/좋아요 검증 트리거, 인덱스, RLS, 비공개 Storage 버킷을 만든다.

공용 DB 적용 전 별도 개발 DB나 브랜치에서 SQL 실행 및 권한 시험이 필요하다. 이 SQL을 실행하기 전에는 홈의 새 섹션이 재시도 가능한 조회 오류를 표시한다.

## Storage 및 배경 제거

- `showcase-private`는 비공개 버킷이며 서버 service role만 업로드·삭제한다. 사진과 PNG 미리보기는 `{ownerId}/{showcaseId}/original|cutout|thumbnail/{uuid}`에 저장된다.
- 클라이언트는 사진을 Express API로 보낸다. 서버가 인증·소유·파일 크기·형식·치수를 검증한다.
- 이미지 조회는 `/api/v1/showcases/:id/media/:path`로만 수행하며, 요청 시마다 공개 상태 또는 소유권을 다시 확인한다. 비공개 사진에는 사용자의 Bearer 토큰이 필요하다.
- 서버 환경변수 `REMOVE_BG_API_KEY`를 설정하면 remove.bg API를 통해 실제 PNG 누끼를 생성한다. 설정이 없거나 실패하면 UI에 오류와 재시도를 표시하고 원본 사진으로 계속 편집할 수 있다. 사진이 외부 처리 서비스로 전송된다는 안내가 화면에 표시된다.
- 백엔드에는 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`가 필요하다. 서비스 키를 `VITE_` 환경변수에 넣지 않는다. 프론트에는 기존 `VITE_API_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 사용한다.

## API

`/api/v1/showcases` 아래에 공개 목록/상세/배경/카테고리, 내 목록/매장 상품, 생성/저장/삭제, 이미지 업로드/배경 제거/조회, 좋아요 등록/해제가 있다. 저장은 `version`을 통한 충돌 확인과 RPC 트랜잭션으로 배치를 교체한다. 장바구니는 기존 `/cart/items`를 사용한다.

## 실제 동작 확인

1. 독립된 테스트 프로젝트에 SQL을 적용한다.
2. 백엔드와 프론트 환경변수를 설정하고 각각 `npm run dev`를 실행한다.
3. 서로 다른 두 계정과 승인된 판매자 계정으로 개인 진열장 3개, 매장 진열장 3개를 만들고 공개/비공개, 업로드, 배경 제거, 저장 후 재편집, 좋아요, 상품 시트, 장바구니를 검증한다.
4. 다른 계정의 비공개 상세와 미디어 URL은 404, 수정은 403, 다른 매장 상품 저장은 403이어야 한다.

현재 저장소에서는 이 실계정·실DB 검증을 수행하지 않았다. 완성된 미리보기는 저장 시 PNG로 생성하고, 카드에서도 저장된 배치를 직접 렌더링한다. 외부 상품 이미지의 CORS 제한 등으로 PNG 생성이 실패하면 배치 저장은 유지되고 화면에 실패 안내가 표시된다. 공개 목록 카테고리 필터는 `showcases_by_category` RPC에서 상품 관계를 검사한 뒤 페이지 단위로 조회한다.
