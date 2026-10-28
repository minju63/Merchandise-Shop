// 담당: 민주
// 배너 서비스 — 비즈니스 로직, DB 접근은 repositories/ 를 통해서만
import { incrementBannerClick } from '../repositories/banner.repository.js';

// TODO: getBanners
export async function clickBanner(bannerId) {
  const found = await incrementBannerClick(bannerId).catch((error) => {
    if (error.code === '22P02') return false;
    throw error;
  });
  if (!found) {
    const error = new Error('배너를 찾을 수 없습니다.');
    error.status = 404;
    throw error;
  }
}
