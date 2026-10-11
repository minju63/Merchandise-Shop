// 담당: 민주
// 홈 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 home.service.js
import { fail } from '../utils/response.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/home — 홈 화면 전체 섹션
export async function getHome(req, res) {
  // TODO: home.service.js 호출
  notImplemented(res);
}

// GET /api/v1/home/sections/:type — 섹션 더보기 (popular · new · recommend · low-stock · upcoming)
export async function getHomeSection(req, res) {
  // TODO: home.service.js 호출
  notImplemented(res);
}
