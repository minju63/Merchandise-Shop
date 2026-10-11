// 담당: 민주
// 1시간마다 store_products.popularity_score 갱신
// app.js에서 아직 호출하지 않는다 — 구현 후 등록
import cron from 'node-cron';

export function startPopularityJob() {
  return cron.schedule(
    '0 * * * *',
    async () => {
      // TODO: popularity_score 계산 · 갱신
    },
    { timezone: 'Asia/Seoul' }
  );
}
