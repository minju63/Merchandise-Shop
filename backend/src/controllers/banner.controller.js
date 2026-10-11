// 담당: 민주
// 배너 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 banner.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/banners — 배너 목록
export async function getBanners(req, res) {
  // TODO: banner.service.js 호출
  notImplemented(res);
}

// POST /api/v1/banners/:id/click — 배너 클릭 기록
export async function clickBanner(req, res) {
  // TODO: banner.service.js 호출
  notImplemented(res);
}
