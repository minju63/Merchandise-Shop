import cron from 'node-cron';
import { purgeExpiredNotifications } from '../services/notification.service.js';

// 매일 03:10(KST), 생성 후 30일이 지난 알림을 순차적으로 정리한다.
export function startNotificationRetentionJob() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  cron.schedule('10 3 * * *', async () => {
    try {
      await purgeExpiredNotifications();
    } catch (error) {
      console.error('30일 초과 알림 정리 실패:', error);
    }
  }, { timezone: 'Asia/Seoul' });
}
