// 담당: 동균
// 장바구니 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 cart.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/cart — 장바구니 조회 (?type=PICKUP|DELIVERY) 🔒
export async function getCart(req, res) {
  // TODO: cart.service.js 호출
  notImplemented(res);
}

// GET /api/v1/cart/counts — 장바구니 아이콘 뱃지 개수 🔒
export async function getCartCounts(req, res) {
  // TODO: cart.service.js 호출
  notImplemented(res);
}

// POST /api/v1/cart/items — 장바구니 담기 🔒
export async function addCartItem(req, res) {
  // TODO: cart.service.js 호출
  notImplemented(res);
}

// PATCH /api/v1/cart/items/:cartItemId — 수량 변경 · 선택(isSelected) 🔒
export async function updateCartItem(req, res) {
  // TODO: cart.service.js 호출
  notImplemented(res);
}

// DELETE /api/v1/cart/items — 선택 삭제 🔒
export async function deleteCartItems(req, res) {
  // TODO: cart.service.js 호출
  notImplemented(res);
}
