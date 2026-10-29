// 담당: 동균
// 사전예약 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 preorder.service.js
import * as preorderService from '../services/preorder.service.js';
import { ok, fail } from '../utils/response.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIVE_INT = /^[1-9]\d*$/;

function badRequest(res, code, message) {
  res.status(400).json(fail(code, message));
}

// 유효하지 않으면 400 응답을 보내고 null 을 반환한다.
function pagination(req, res) {
  const { page = '1', size = '20' } = req.query;
  if (typeof page !== 'string' || !POSITIVE_INT.test(page) || !Number.isSafeInteger(Number(page))) {
    badRequest(res, 'INVALID_PAGE', 'page는 1 이상의 정수여야 합니다.');
    return null;
  }
  if (typeof size !== 'string' || !POSITIVE_INT.test(size) || Number(size) > 100) {
    badRequest(res, 'INVALID_SIZE', 'size는 1~100 사이의 정수여야 합니다.');
    return null;
  }
  return { page: Number(page), size: Number(size) };
}

function uuid(res, value, name) {
  if (typeof value === 'string' && UUID.test(value)) return value;
  badRequest(res, 'INVALID_REQUEST', `올바른 ${name} 형식이 아닙니다.`);
  return null;
}

function isQuantity(value) {
  return Number.isSafeInteger(value) && value >= 1;
}

// GET /api/v1/preorders/quote — 입고 예정일 · 예약금 · 잔액 · 예상 순번 (?storeProductId=&qty=) 🔒
export async function getPreorderQuote(req, res) {
  const storeProductId = uuid(res, req.query.storeProductId, 'storeProductId');
  if (!storeProductId) return;
  const { qty = '1' } = req.query;
  if (typeof qty !== 'string' || !POSITIVE_INT.test(qty) || !isQuantity(Number(qty)))
    return badRequest(res, 'INVALID_REQUEST', 'qty는 1 이상의 정수여야 합니다.');
  res.json(
    ok(await preorderService.getPreorderQuote({ userId: req.user.id, storeProductId, quantity: Number(qty) })),
  );
}

// POST /api/v1/preorders — 사전예약 신청 (J-06) 🔒
export async function createPreorder(req, res) {
  const storeProductId = uuid(res, req.body?.storeProductId, 'storeProductId');
  if (!storeProductId) return;
  const { quantity = 1 } = req.body;
  if (!isQuantity(quantity))
    return badRequest(res, 'INVALID_REQUEST', 'quantity는 1 이상의 정수여야 합니다.');
  res.json(ok(await preorderService.createPreorder({ userId: req.user.id, storeProductId, quantity })));
}

// GET /api/v1/preorders — 내 사전예약 목록 🔒
export async function getPreorders(req, res) {
  const paging = pagination(req, res);
  if (!paging) return;
  res.json(ok(await preorderService.getPreorders({ userId: req.user.id, ...paging })));
}

// DELETE /api/v1/preorders/:preorderId — 사전예약 취소 🔒
export async function cancelPreorder(req, res) {
  const preorderId = uuid(res, req.params.preorderId, 'preorderId');
  if (!preorderId) return;
  res.json(ok(await preorderService.cancelPreorder({ userId: req.user.id, preorderId })));
}
