# 굿즈샵 Q&A 구현 및 검증 기록

2026-11-02 구현. 프론트/백엔드 코드는 로컬 변경이며 배포하지 않았습니다. 아래 DB 마이그레이션 세 개는 연결된 Supabase 프로젝트 `twjqulccljimqwggzrpf`에 실제 적용했습니다. 후속 요청으로 답변대기 문의의 본인 수정·삭제를 추가했습니다.

## 기존 구조 분석과 재사용

- 상품 상세 Q&A는 `ProductInquirySection.jsx`의 FAQ/내 문의 탭과 접이식 `InquiryList`, `InquiryForm.jsx`의 제목·내용 입력을 사용합니다.
- 상품 문의는 `inquiries.category = PRODUCT`와 매장 ID로 연결되고, 개인 문의는 서버에서 로그인 작성자 ID로 제한합니다. 상품별 FK가 있는 구조는 아닙니다. 공개 FAQ는 기존 코드가 지정한 샘플 ID만 허용합니다.
- 기존 상품 작성 폼에는 비밀글 선택, 수정·삭제 UI, 판매자 답변 관리 UI가 없습니다. 기존 고객센터의 수정·삭제 기능과 상품 Q&A UI는 별개입니다.
- 기존 `inquiries`에는 주문·계정 등 고객센터 문의도 있으므로 공개 범위를 넓히지 않았습니다. 새 문의는 상품과 연결하지 않고 `store_inquiries.store_id`로 매장에 연결합니다.
- `InquiryList`를 내보내 매장 문의에도 사용하고, 매장 표시 옵션으로 작성자·답변일·미답변 안내만 추가했습니다. 상품 기본 동작과 샘플 문구 처리는 유지됩니다.
- `InquiryForm`에 선택 옵션을 추가해 제목·내용, 기존 등록 상태/오류 안내를 재사용합니다. 상품 기본 레이블과 내용 길이 정책은 유지됩니다. 새 매장 문의는 제목 1~100자, 내용 1~5,000자입니다.
- 기존 `requireAuth`가 Supabase `getUser`로 검증한 사용자를 사용합니다. 클라이언트의 작성자 ID·상태·답변 필드는 저장하지 않습니다.
- 상세의 기존 `guide-grid`, `StoreGuide`, 배송·픽업 표시 컴포넌트와 Q&A 페이지의 기존 리뷰 헤더·버튼·페이지네이션 스타일을 재사용합니다.

## 화면과 데이터 흐름

1. 상세 메뉴는 `찾아가기 / 영업시간 / 배송·픽업 안내 / Q&A` 순서입니다. 메뉴의 4칸, 높이, 테두리, 배경, 아이콘 규격을 유지하고 긴 글자의 줄바꿈만 허용합니다.
2. 통합 안내는 상세 API가 이미 제공하는 `pickupInfo`, `deliveryInfo`, 지원 여부, `deliveryAreas`를 사용합니다. 두 수령 방식을 구분하며, 미지원/미등록 상태를 각각 안내합니다. 비용·무료배송 기준·준비시간·보관기간·주차·안내문을 보존합니다.
3. 기존 고정 문구였던 배송 지역은 DB의 지역명을 `등록된 배송 지역`으로 표시합니다. 이 표시는 등록 지역 정보이며, 결제 단계의 배송 가능 여부나 배송비 계산 정책을 변경하지 않습니다.
4. Q&A는 `/stores/:storeId/inquiries` 별도 페이지입니다. 매장 이름, 총 개수, 상태, 작성자 닉네임, 작성일, 제목을 표시하고 항목을 펼치면 내용·답변·답변일을 표시합니다. 미답변 안내가 있으며 10개씩 페이지를 나눕니다.
5. `문의하기`는 `?write=1` 상태로 작성 바텀시트를 엽니다. 비로그인 사용자는 기존 로그인 화면으로 이동하고 `returnTo`로 작성 흐름에 돌아옵니다.
6. 폼은 공개 문의임을 안내합니다. 기존 상품 폼에 비밀글 옵션이 없어 이번에도 비밀글 기능은 추가하지 않았습니다. 기존 비공개 고객센터/상품 문의를 공개 목록에 섞지 않습니다.
7. 매장 ID 변경 시 페이지 상태를 초기화하고 조회 키를 분리합니다. 이전 매장의 요청은 취소하며 이전 매장 목록을 다음 매장에 표시하지 않습니다.
8. 답변은 30초 주기 조회 또는 화면 재진입/포커스 복귀 시 갱신됩니다.

## 서버 API

| API | 인증 및 동작 |
| --- | --- |
| `GET /api/v1/stores/:storeId/inquiries?page=1&size=10` | 로그인 불필요. ACTIVE 매장만 허용하고 매장 ID로 목록과 개수를 제한합니다. |
| `POST /api/v1/stores/:storeId/inquiries` | 검증된 일반 로그인 세션과 ACTIVE 회원 필요. `{title, content, requestId}`를 받습니다. |
| `PATCH /api/v1/stores/:storeId/inquiries/:inquiryId` | ACTIVE 작성자 본인의 답변대기·미삭제 문의만 제목·내용 수정 가능. |
| `DELETE /api/v1/stores/:storeId/inquiries/:inquiryId` | ACTIVE 작성자 본인의 답변대기·미삭제 문의만 삭제 가능. |
| `PUT /api/v1/stores/:storeId/inquiries/:inquiryId/answer` | ACTIVE 회원, SELLER/ADMIN 역할, 해당 매장 소유권을 모두 요구합니다. `{content}`를 받아 ANSWERED와 답변자·답변일을 저장합니다. |

판매자 Q&A 관리 화면은 기존 프로젝트에 없어 새로 만들지 않았습니다. 답변 API와 DB 검증은 구현했으며 판매자 화면 연결은 후속 작업입니다. 임의 답변이나 가짜 완료 상태는 넣지 않았습니다.

## DB와 RLS

실제 적용된 마이그레이션:

- `backend/supabase/migrations/20261102091020_store_inquiries.sql`
- `backend/supabase/migrations/20261102091825_store_inquiry_seller_role_guard.sql`
- `backend/supabase/migrations/20261102110336_store_inquiry_pending_changes.sql`

테이블에는 매장·작성자 FK, 제목·내용, PENDING/ANSWERED 상태, 답변·답변자 FK·답변일, 작성일, 요청 ID를 저장합니다. `(user_id, request_id)` 유일 제약으로 같은 등록 요청을 재시도해도 한 건만 저장합니다. 제목/내용의 길이·공백, 상태와 답변 필드의 일관성도 DB에서 검증합니다.

RLS `store_inquiries_backend_only`는 anon/authenticated의 직접 접근을 차단합니다. 두 역할과 PUBLIC의 테이블 권한도 회수했습니다. 공개 목록도 기존 프로젝트처럼 백엔드 API가 반환하며, 브라우저에 서버 키를 전달하지 않습니다. service_role에는 필요한 서버 접근을 명시적으로 부여했습니다. 새 테이블은 명시적 GRANT가 필요하다는 [Supabase 공식 안내](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)를 확인했습니다.

`validate_store_inquiry` 트리거는 활성 매장·작성자를 검증하고 질문의 연결 변경을 막습니다. 답변 전에는 제목·내용 수정과 `deleted_at`을 이용한 삭제를 허용합니다. 작성자 권한은 서버의 조건부 UPDATE에서 매장·작성자·PENDING·미삭제 조건으로 검증하며, 답변이 등록된 뒤의 수정·삭제는 DB 트리거도 차단합니다. 답변 수정은 현재 매장 소유자이며 ACTIVE SELLER/ADMIN인 답변자만 허용합니다. 이 검증은 service_role 쓰기에도 실행됩니다. 함수는 security invoker와 고정 search_path를 사용하고 클라이언트 실행 권한을 회수했습니다.

삭제 문의는 목록과 개수에서 제외합니다. 행과 요청 ID는 남겨 지연된 등록 재시도가 삭제 문의를 다시 만들지 못하도록 합니다. 삭제 행의 수정·복원·답변과 물리 삭제는 트리거에서 차단합니다. 클라이언트 직접 접근 차단 RLS는 그대로 유지합니다.

기존 테이블·데이터·RLS를 수정하거나 삭제하지 않았습니다. 적용 후 기존 `inquiries`는 18행으로 유지되었습니다.

다른 환경에 적용할 때는 해당 환경의 매장/사용자 스키마를 확인한 뒤 세 SQL 파일을 위 순서대로 Supabase SQL Editor에서 실행하세요. 현재 연결된 프로젝트에는 이미 적용되어 있으므로 다시 실행하지 마세요. 로컬 파일 버전은 원격 migration history와 일치시켰습니다. 저장소에 전체 DB 초기 스키마가 없으므로 신규 DB에 모든 migration을 무조건 일괄 실행하는 방식은 권장하지 않습니다.

## 예외 처리

- 빈 값·공백·길이 초과를 폼/서버/DB에서 차단하고 등록 중 입력·버튼을 비활성화합니다. 동기 ref로 연속 제출도 막습니다.
- 실패 시 입력과 요청 ID를 보존합니다. 응답 유실 후 같은 요청을 다시 보내면 기존 행을 반환합니다. 이미 저장된 요청 ID에 다른 내용을 보내면 409로 구분하고 새 요청으로 재시도할 수 있게 안내합니다.
- 작성 초안과 요청 ID는 매장/사용자별 sessionStorage에 저장합니다. 닫기·뒤로 가기·로그인 이동 후 같은 탭에서 복원됩니다. 탭을 닫으면 사라집니다. 저장소 사용 불가 시 경고합니다.
- 요청 중 화면을 떠나도 이미 진행된 저장은 중복 요청 키로 추적합니다. 화면이 사라진 뒤 도착한 응답으로 로그인 이동이나 바텀시트 닫기 내비게이션을 실행하지 않습니다.
- 본인 답변대기 문의를 펼치면 수정·삭제 버튼이 표시됩니다. 수정은 기존 바텀시트를 사용하며, 삭제는 확인창을 거칩니다. 실패 시 입력을 보존하고, 성공/상태 충돌 시 목록과 개수를 갱신합니다. 로그인 계정별 조회 캐시를 분리합니다.
- 로딩·빈 목록·조회 실패·재시도·잘못된 UUID/페이지·없는 매장·비활성 매장·접근 불가능한 문의를 처리합니다.
- 인증 설정/세션 오류를 별도로 안내하며 공개 목록은 독립적으로 조회합니다. 익명 Auth 세션, 정지/탈퇴 회원은 작성할 수 없습니다.
- 타 매장 판매자와 일반 소비자의 답변을 서버에서 거절하고, 문의 업데이트에도 매장 ID를 함께 제한합니다.
- 질문과 답변은 React 텍스트로 렌더링합니다. 공개 목록에서 이메일·작성자 ID·요청 ID를 반환하지 않습니다.
- 바텀시트에 스크롤 잠금, Escape, 키보드 포커스 순환, 안전 영역 여백과 visualViewport 높이 대응을 추가했습니다.

## 변경 파일

신규:

- `backend/src/controllers/storeInquiry.controller.js`
- `backend/src/repositories/storeInquiry.repository.js`
- `backend/src/services/storeInquiry.service.js`
- 위 마이그레이션 세 파일
- `backend/tests/storeInquiry.test.js`
- `frontend/src/api/storeInquiry.api.js`
- `frontend/src/pages/stores/StoreInquiryPage.jsx`
- `frontend/src/pages/stores/StoreInquiryPage.css`
- `frontend/src/pages/stores/components/StoreInquirySheet.jsx`
- 이 문서

수정:

- `backend/src/routes/store.routes.js`
- `frontend/src/App.jsx`, `frontend/src/App.css`, `frontend/src/components/Icon.jsx`
- `frontend/src/pages/category/components/ProductInquirySection.jsx`, `InquiryForm.jsx`
- `frontend/src/pages/stores/components/StoreInfo.jsx`, `StoreGuide.jsx`, `StoreDeliveryInfo.jsx`

## 검증 결과와 제한

- 백엔드 전체 테스트 77개 통과(Q&A 10개 포함), 백엔드 lint 통과.
- 프론트 Vite production build 통과. 번들 500KB 경고는 남아 있습니다.
- 변경 프론트 파일의 ESLint 오류 없음. 기존 상품 Q&A 파일의 의존성 경고 1개는 유지했습니다.
- 전체 프론트 lint는 기존 `ProductDetailPage.jsx`, `StoreMapPage.jsx`의 effect 내 setState, `SearchPage.jsx`의 export 규칙 오류로 실패합니다. 이 세 파일은 수정하지 않았습니다.
- 기존 프론트 필터 테스트는 7개 중 2개 통과/5개 실패합니다. 기본 `inStock`과 `brands/includeSoldOut` 기대값 차이이며 테스트와 대상 소스 모두 HEAD와 동일함을 확인했습니다. 이번 범위에 포함해 고치지 않았습니다.
- 실제 API: 서로 다른 두 매장 공개 GET 200과 각 매장 이름/빈 목록, 잘못된 ID 400, 없는 매장 404, 무토큰/잘못된 토큰 POST 401을 확인했습니다. 공개 GET은 잘못된 토큰에도 공개 조회로 동작합니다.
- 기존 상품 Q&A 실제 GET 200, 공개 FAQ 3개/개인 문의 0개 반환을 확인했습니다. 상품 Q&A 기존 회귀 테스트도 통과했습니다.
- 실제 매장 상세 API의 배송비·무료배송 기준·배송일·픽업 준비/보관시간·주차·지역 데이터를 확인했습니다.
- 실제 Supabase 트랜잭션에서 등록, 동일 요청 중복 방지, 공백/최대 길이 차단, 일반 소비자 답변 거절, 판매자 소유자 답변 저장, 질문 변경 차단, 클라이언트 권한 차단을 검증했습니다. 실제 service_role로 등록/답변도 확인했으며 전부 ROLLBACK했습니다. 테스트 문의는 0건입니다.
- 초기 마이그레이션 후 Security Advisor에서 새 테이블/함수 관련 지적은 없었습니다. 프로젝트의 기존 다른 객체 관련 지적은 이번에 변경하지 않았습니다.
- 연결 가능한 브라우저가 없어 실제 화면 클릭, 모바일 시각 검수·키보드 동작, 로그인 사용자 UI 등록 및 판매자 UI 흐름은 검증하지 못했습니다. 렌더링 테스트 도입도 현재 Vite SSR 실행 환경 문제로 성립하지 않아 남겨두지 않았습니다. 빌드는 시각 검수의 증거가 아닙니다.
- 판매자 답변 관리 UI는 미구현입니다. 비밀글은 기존 상품 Q&A 폼에 없어 추가하지 않았습니다. 후속 요청의 수정·삭제는 굿즈샵 Q&A에만 추가했으며 상품 Q&A에는 추가하지 않았습니다. TypeScript 프로젝트가 아니고 별도 typecheck 스크립트도 없어 타입 검사를 실행했다고 보고하지 않습니다.

후속 수정·삭제 검증: 실제 service_role 트랜잭션에서 답변대기 수정/삭제 성공, 타인·타 매장 조건 불일치, 답변 후 조건부 변경 0건 및 강제 변경 거절, 삭제 문의의 재생성/복원 거절을 확인했습니다. 모두 ROLLBACK하여 기존 굿즈샵 문의 19건을 유지했습니다. 실제 공개 목록 API는 200, 무토큰 PATCH/DELETE는 401입니다. Security Advisor에서 새 기능 관련 지적은 없으며, 연결된 브라우저가 없어 수정·삭제 버튼의 실제 클릭 검증은 하지 못했습니다.

재실행 명령:

```powershell
cd backend
npm.cmd test
npm.cmd run lint
cd ../frontend
node node_modules/vite/bin/vite.js build --configLoader native
node --test --test-isolation=none tests/*.test.js
```
