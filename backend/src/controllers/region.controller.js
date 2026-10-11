// 담당: 은혜
// 지역 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 region.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/regions — 지역 목록
export async function getRegions(req, res) {
  // TODO: region.service.js 호출
  notImplemented(res);
}
