// 담당: 동균
// 사전예약 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 preorder.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/preorders/quote — 입고 예정일 · 예약금 · 잔액 · 예상 순번 (?storeProductId=&qty=) 🔒
export async function getPreorderQuote(req, res) {
  // TODO: preorder.service.js 호출
  notImplemented(res);
}

// POST /api/v1/preorders — 사전예약 신청 (J-06) 🔒
export async function createPreorder(req, res) {
  // TODO: preorder.service.js 호출
  notImplemented(res);
}

// GET /api/v1/preorders — 내 사전예약 목록 🔒
export async function getPreorders(req, res) {
  // TODO: preorder.service.js 호출
  notImplemented(res);
}

// DELETE /api/v1/preorders/:preorderId — 사전예약 취소 🔒
export async function cancelPreorder(req, res) {
  // TODO: preorder.service.js 호출
  notImplemented(res);
}
