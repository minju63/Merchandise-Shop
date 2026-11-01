# 굿즈샵 지도와 재고 찾기

기존 굿즈샵 목록의 **지도에서 굿즈·재고 찾기**에서 `/stores/map`으로 이동한다. 기존 목록의 영업 중·픽업·배달 필터를 전달한다. 지도 내부 목록보기는 검색 조건과 지도 영역을 URL에 유지한다.

지도는 Leaflet 1.9.4와 OpenStreetMap 타일을 사용한다. 별도 지도 API 키는 필요하지 않으며 타일 서버에 접근할 수 있어야 한다. 출처 표시는 지도 하단에 유지한다.

## API

- `GET /api/v1/stores/map`
- `GET /api/v1/products/:productId/stores` — 통합 `products.id`를 받는다. 기존 상품 상세의 `storeProductId`와 구분한다.

공통 query: `productId`, `keyword`(최대 200자), `regionId`, `openNow`, `pickup`, `delivery`, `inStock`, `sort`(`popular`, `stock`, `distance`), `latitude`, `longitude`, `radius`(km). 거리순과 반경은 기준 위도·경도를 함께 요구한다. 지도 범위는 `south`, `north`, `west`, `east`를 함께 전달한다.

응답은 기존 `{ success, data, message }` 형식이다. `data.items`는 매장 ID·이름·주소·좌표·이미지·지역·재고·판매 상태·수령 가능 여부·영업 중 여부·거리·선택 판매상품 ID를 포함한다. `data.products`는 검색어에 맞는 상품 선택 후보, `data.regions`는 지역 필터다. 판매·숨김 상태의 상품은 후보에서도 제외한다.

## 재고 규칙

- 운영 중인 `ACTIVE` 매장과 `ON_SALE`/`SOLD_OUT` 상품·판매상품만 조회한다.
- 구매 가능한 재고는 상품과 판매상품 모두 `ON_SALE`이고 `store_products.stock > 0`일 때다.
- `SOLD_OUT`에 수량이 남아 있으면 실제 등록 수량과 품절 상태를 함께 표시하고 회색 마커를 사용한다.
- 상품별 픽업·배달은 매장과 판매상품 양쪽의 해당 플래그를 모두 만족해야 한다.
- 위치 정보가 없거나 유효하지 않은 매장은 지도 API에서 제외한다. 기존 목록 API는 변경하지 않는다.
- 재고 테이블·캐시를 추가하지 않는다. 지도 조회는 `no-store`, 화면은 30초마다 다시 조회한다. 실시간 구독 방식은 아니다. 구매 전 검증은 기존 주문 처리를 사용한다.

## 검증

`backend`에서 `npm test`, `frontend`에서 `npm run build`를 실행한다. `backend/tests/storeMap.test.js`는 품절 상태 우선, 필터 결합, 검색, 좌표·거리·범위, 입력 검증과 저장소 조회 조건을 검증한다.

현재 저장소의 기존 조회 방식처럼 서버에서 테이블을 페이지 단위로 읽은 뒤 조건을 적용한다. 데이터 규모가 커지면 DB의 공간 인덱스와 검색 쿼리로 필터링을 옮기는 것이 필요하다.
