카테고리 전용 미리보기

frontend 폴더에서 `npm run dev` 후 다음 주소를 엽니다.

http://localhost:5173/src/pages/category/components/preview.html

Vite가 다른 포트를 표시하면 그 포트를 사용하세요. 공용 App, 백엔드, Supabase는 실행할 필요가 없습니다.
상품/카테고리/지역/문의는 categoryMock.js에서 관리합니다. 모든 이미지도 인라인 샘플입니다.
샘플 로그인, 필터, 정렬, 상세, 매장 기준의 내 문의, 찜과 액션을 확인할 수 있습니다.
구매/장바구니/알림/예약은 메모리 이벤트만 기록하며 실제 주문을 만들지 않습니다.
새로고침하면 샘플 상태가 초기화됩니다.

실제 연결로 전환

페이지 코드를 다시 작성할 필요가 없습니다. 공용 라우트 담당자가 아래 props만 교체합니다.

- CategoryPage: mock.api 대신 공용 client를 전달하고 api prop을 생략합니다.
- ProductListPage: api를 생략하고 client, 공용 ProductCard, 실제 regions/categories/user를 전달합니다.
- ProductDetailPage: api와 inquiryApi를 생략하고 client, 공용 ProductCard, 실제 user/actions/onLogin을 전달합니다.
- client는 baseURL이 VITE_API_BASE_URL인 공용 Axios client이며 로그인 토큰 처리도 공용 담당입니다.
- DemoProductSummary는 미리보기 전용이며 실제 화면에서는 공용 ProductCard를 사용합니다.
- 백엔드의 공용 인증/상품 Repository/라우트 연결은 실제 전환 전에 필요합니다.

실제 데이터 조회 미리보기

http://localhost:5173/src/pages/category/components/preview.html?live=1

기본 주소는 샘플 모드를 유지합니다. `live=1`일 때만 카테고리, 상품 목록,
상품 상세, 관련 상품을 공용 Axios client로 조회합니다. 카테고리 제목에는 실제 DB ID를 사용합니다.
백엔드도 실행되어 있어야 하며 현재 Vite 프록시는 `/api`를 localhost:4000으로 전달합니다.
다른 포트로 프런트엔드를 실행하면 URL의 5173을 해당 포트로 바꾸세요.

실제 모드는 비로그인 조회 전용입니다. 샘플 로그인과 모의 구매/찜/문의 등록을 연결하지 않습니다.
지역 공용 API가 아직 없어 지역 선택에는 전체 지역만 표시합니다. 샘플 지역 ID를 실제 API로 보내지 않습니다.
기존 DB 데이터와 시드는 변경하지 않습니다. 실제 인증/쓰기 기능은 별도 연동 후 활성화합니다.
