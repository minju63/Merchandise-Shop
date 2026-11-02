import * as service from '../services/notification.service.js';
import { ok } from '../utils/response.js';

const handle = (action) => async (req, res, next) => {
  try {
    res.json(ok(await action(req, res)));
  } catch (error) {
    next(error);
  }
};

const userId = (res) => res.locals.authUser.id;

// GET /api/v1/notifications — 알림 목록 🔒
export const getNotifications = handle((_req, res) => service.getNotifications(userId(res)));

// PATCH /api/v1/notifications/read-all — 전체 읽음 🔒
export const readAllNotifications = handle((_req, res) => service.readAllNotifications(userId(res)));

// PATCH /api/v1/notifications/:id/read — 알림 읽음 🔒
export const readNotification = handle((req, res) => service.readNotification(userId(res), req.params.id));

// GET /api/v1/notifications/badges — 헤더 뱃지 (알림 · 장바구니 개수) — /header/badges
export const getHeaderBadges = handle((_req, res) => service.getHeaderBadges(userId(res)));
