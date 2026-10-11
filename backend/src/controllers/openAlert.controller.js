// 담당: 민주
// 오픈 알림 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 openAlert.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// POST /api/v1/open-alerts — 오픈 알림 신청 🔒
export async function createOpenAlert(req, res) {
  // TODO: openAlert.service.js 호출
  notImplemented(res);
}

// DELETE /api/v1/open-alerts/:productId — 오픈 알림 해제 🔒
export async function deleteOpenAlert(req, res) {
  // TODO: openAlert.service.js 호출
  notImplemented(res);
}
