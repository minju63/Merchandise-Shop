// 담당: 미정
// 알림 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 notification.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/notifications — 알림 목록 🔒
export async function getNotifications(req, res) {
  // TODO: notification.service.js 호출
  notImplemented(res);
}

// PATCH /api/v1/notifications/read-all — 전체 읽음 🔒
export async function readAllNotifications(req, res) {
  // TODO: notification.service.js 호출
  notImplemented(res);
}

// PATCH /api/v1/notifications/:id/read — 알림 읽음 🔒
export async function readNotification(req, res) {
  // TODO: notification.service.js 호출
  notImplemented(res);
}

// GET /api/v1/notifications/badges — 헤더 뱃지 (알림 · 장바구니 개수) — /header/badges
export async function getHeaderBadges(req, res) {
  // TODO: notification.service.js 호출
  notImplemented(res);
}
