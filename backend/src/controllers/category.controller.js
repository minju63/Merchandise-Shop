// 담당: 은혜
// 카테고리 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 category.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/categories — 카테고리 목록 (?type=CONTENT|GOODS, ?home=true)
export async function getCategories(req, res) {
  // TODO: category.service.js 호출
  notImplemented(res);
}
