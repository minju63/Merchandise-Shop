// 담당: 동균
// 재입고 알림 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 restockAlert.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/restock-alerts — 내 재입고 알림 목록 (M-10a) 🔒
export async function getRestockAlerts(req, res) {
  // TODO: restockAlert.service.js 호출
  notImplemented(res);
}

// POST /api/v1/restock-alerts — 재입고 알림 신청 (J-03) 🔒
export async function createRestockAlert(req, res) {
  // TODO: restockAlert.service.js 호출
  notImplemented(res);
}

// DELETE /api/v1/restock-alerts/:storeProductId — 재입고 알림 해제 (J-04 · M-10a) 🔒
export async function deleteRestockAlert(req, res) {
  // TODO: restockAlert.service.js 호출
  notImplemented(res);
}
