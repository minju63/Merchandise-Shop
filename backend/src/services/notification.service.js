// 알림 서비스 — 목록을 열면 모두 읽음, 받은 뒤 30일간 보관한다.
import * as repository from '../repositories/notification.repository.js';

export const NOTIFICATION_RETENTION_DAYS = 30;
const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const failure = (status, code, message) => Object.assign(new Error(message), { status, code });

export function retentionCutoff(now = new Date()) {
  return new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

const toItem = (row) => ({
  id: row.id,
  type: row.type,
  title: row.title,
  body: row.body,
  targetType: row.target_type,
  targetId: row.target_id,
  isRead: row.is_read,
  createdAt: row.created_at,
});

export async function getNotifications(userId, context = {}) {
  await repository.deleteExpired(retentionCutoff(context.now), userId);
  const rows = await repository.listForUser(userId);
  return { items: rows.map(toItem), retentionDays: NOTIFICATION_RETENTION_DAYS };
}

export async function readAllNotifications(userId, context = {}) {
  await repository.deleteExpired(retentionCutoff(context.now), userId);
  const updatedCount = await repository.markAllRead(userId);
  return { read: true, updatedCount };
}

export async function readNotification(userId, notificationId) {
  if (!UUID_PATTERN.test(String(notificationId ?? ''))) {
    throw failure(404, 'NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없어요.');
  }
  const notification = await repository.markRead(userId, notificationId);
  if (!notification) throw failure(404, 'NOTIFICATION_NOT_FOUND', '알림을 찾을 수 없어요.');
  return { id: notification.id, read: true };
}

export async function getHeaderBadges(userId, context = {}) {
  await repository.deleteExpired(retentionCutoff(context.now), userId);
  const [notifications, cart] = await Promise.all([
    repository.countUnread(userId),
    repository.countCartItems(userId),
  ]);
  return { notifications, cart };
}

export async function purgeExpiredNotifications(context = {}) {
  return { deletedCount: await repository.deleteExpired(retentionCutoff(context.now)) };
}
