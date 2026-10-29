// 담당: 동균
// 장바구니 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 cart.service.js
import * as cartService from '../services/cart.service.js';
import { ok, fail } from '../utils/response.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FULFILLMENT_TYPES = ['PICKUP', 'DELIVERY'];

function badRequest(res, code, message) {
  res.status(400).json(fail(code, message));
}

function uuid(res, value, name) {
  if (typeof value === 'string' && UUID.test(value)) return value;
  badRequest(res, 'INVALID_REQUEST', `올바른 ${name} 형식이 아닙니다.`);
  return null;
}

function isQuantity(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

// GET /api/v1/cart — 장바구니 조회 (?type=PICKUP|DELIVERY) 🔒
export async function getCart(req, res) {
  const { type = 'PICKUP' } = req.query;
  if (!FULFILLMENT_TYPES.includes(type))
    return badRequest(res, 'INVALID_REQUEST', 'type은 PICKUP 또는 DELIVERY여야 합니다.');
  res.json(ok(await cartService.getCart({ userId: req.user.id, type })));
}

// GET /api/v1/cart/counts — 장바구니 아이콘 뱃지 개수 🔒
export async function getCartCounts(req, res) {
  res.json(ok(await cartService.getCartCounts(req.user.id)));
}

// POST /api/v1/cart/items — 장바구니 담기 🔒
export async function addCartItem(req, res) {
  const { quantity = 1, fulfillmentType } = req.body ?? {};
  const storeProductId = uuid(res, req.body?.storeProductId, 'storeProductId');
  if (!storeProductId) return;
  if (!isQuantity(quantity))
    return badRequest(res, 'INVALID_REQUEST', 'quantity는 1 이상의 정수여야 합니다.');
  if (!FULFILLMENT_TYPES.includes(fulfillmentType))
    return badRequest(res, 'INVALID_REQUEST', 'fulfillmentType은 PICKUP 또는 DELIVERY여야 합니다.');
  res.json(
    ok(await cartService.addCartItem({ userId: req.user.id, storeProductId, quantity, fulfillmentType })),
  );
}

// PATCH /api/v1/cart/items/:cartItemId — 수량 변경 · 선택(isSelected) 🔒
export async function updateCartItem(req, res) {
  const cartItemId = uuid(res, req.params.cartItemId, 'cartItemId');
  if (!cartItemId) return;
  const { quantity, isSelected } = req.body ?? {};
  if (quantity === undefined && isSelected === undefined)
    return badRequest(res, 'INVALID_REQUEST', 'quantity 또는 isSelected가 필요합니다.');
  if (quantity !== undefined && !isQuantity(quantity))
    return badRequest(res, 'INVALID_REQUEST', 'quantity는 1 이상의 정수여야 합니다.');
  if (isSelected !== undefined && typeof isSelected !== 'boolean')
    return badRequest(res, 'INVALID_REQUEST', 'isSelected는 true 또는 false여야 합니다.');
  res.json(
    ok(await cartService.updateCartItem({ userId: req.user.id, cartItemId, quantity, isSelected })),
  );
}

// DELETE /api/v1/cart/items — 선택 삭제 🔒
export async function deleteCartItems(req, res) {
  const ids = req.body?.ids;
  if (!Array.isArray(ids) || ids.length === 0)
    return badRequest(res, 'INVALID_REQUEST', 'ids는 비어 있지 않은 배열이어야 합니다.');
  if (!ids.every((id) => typeof id === 'string' && UUID.test(id)))
    return badRequest(res, 'INVALID_REQUEST', '올바른 cartItemId 형식이 아닙니다.');
  res.json(ok(await cartService.deleteCartItems({ userId: req.user.id, cartItemIds: [...new Set(ids)] })));
}
