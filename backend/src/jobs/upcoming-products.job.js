import cron from 'node-cron';
import { openDueProducts } from '../services/upcoming.service.js';

export function startUpcomingProductsJob() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  cron.schedule('* * * * *', async () => {
    try {
      await openDueProducts();
    } catch (error) {
      console.error('입고 예정 상품 상태 전환 실패:', error);
    }
  }, { timezone: 'Asia/Seoul' });
}
