// 담당: 동균
// 재입고 알림 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 restockAlert.service.js
import * as restockAlertService from '../services/restockAlert.service.js';
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

// GET /api/v1/restock-alerts — 내 재입고 알림 목록 (M-10a) 🔒
export async function getRestockAlerts(req, res) {
  const paging = pagination(req, res);
  if (!paging) return;
  res.json(ok(await restockAlertService.getRestockAlerts({ userId: req.user.id, ...paging })));
}

// POST /api/v1/restock-alerts — 재입고 알림 신청 (J-03) 🔒
export async function createRestockAlert(req, res) {
  const storeProductId = uuid(res, req.body?.storeProductId, 'storeProductId');
  if (!storeProductId) return;
  res.json(ok(await restockAlertService.createRestockAlert({ userId: req.user.id, storeProductId })));
}

// DELETE /api/v1/restock-alerts/:storeProductId — 재입고 알림 해제 (J-04 · M-10a) 🔒
export async function deleteRestockAlert(req, res) {
  const storeProductId = uuid(res, req.params.storeProductId, 'storeProductId');
  if (!storeProductId) return;
  res.json(ok(await restockAlertService.deleteRestockAlert({ userId: req.user.id, storeProductId })));
}
