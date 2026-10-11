// 담당: 은혜
// 지역 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 region.service.js
import * as regionService from '../services/region.service.js';

// GET /api/v1/regions — 지역 목록
export async function getRegions(req, res, next) {
  try {
    const data = await regionService.getRegions();
    return res.status(200).json({ success: true, data, message: null });
  } catch (error) {
    return next(error);
  }
}
