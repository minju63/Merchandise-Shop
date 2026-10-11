// 담당: 은혜
// 상품 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 product.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/products — 상품 목록 · 필터 · 정렬
export async function getProducts(req, res) {
  // TODO: product.service.js 호출
  notImplemented(res);
}

// GET /api/v1/products/:storeProductId — 판매상품 상세 (공용 상품 상세)
export async function getProductDetail(req, res) {
  // TODO: product.service.js 호출
  notImplemented(res);
}

// GET /api/v1/products/:storeProductId/related — 관련 상품
export async function getRelatedProducts(req, res) {
  // TODO: product.service.js 호출
  notImplemented(res);
}
