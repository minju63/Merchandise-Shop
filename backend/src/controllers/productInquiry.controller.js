// 담당: 은혜
// 상품 Q&A 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 productInquiry.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/products/:storeProductId/inquiries — 상품 Q&A
export async function getProductInquiries(req, res) {
  // TODO: productInquiry.service.js 호출
  notImplemented(res);
}

// POST /api/v1/products/:storeProductId/inquiries — 상품 문의 작성 🔒
export async function createProductInquiry(req, res) {
  // TODO: productInquiry.service.js 호출
  notImplemented(res);
}
