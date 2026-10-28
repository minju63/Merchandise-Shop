// 담당: 민주
// 홈 컨트롤러 — 요청 검증 · 응답 형식만 담당, 로직은 home.service.js
import { fail, ok } from '../utils/response.js';
import * as homeService from '../services/home.service.js';
import * as homeBannerService from '../services/homeBanner.service.js';

const notImplemented = (res) =>
  res.status(501).json(fail('NOT_IMPLEMENTED', '아직 구현되지 않았습니다'));

// GET /api/v1/home — 홈 화면 전체 섹션
export async function getHome(req, res) {
  res.json(ok(await homeService.getHome()));
}

// GET /api/v1/home/banners/:bannerId — 광고 배너 상세
export async function getAdDetail(req, res) {
  res.json(ok(await homeBannerService.getAdDetail(req.params.bannerId)));
}

// GET /api/v1/home/service-intro/:bannerId — 서비스 소개 배너 상세
export async function getServiceIntro(req, res) {
  res.json(ok(await homeBannerService.getServiceIntro(req.params.bannerId)));
}

// GET /api/v1/home/exhibitions/:bannerId?character=&type=&inStock= — 기획전 배너 상세
export async function getExhibition(req, res) {
  const { character, type, inStock } = req.query;
  res.json(ok(await homeBannerService.getExhibition(req.params.bannerId, { character, type, inStock })));
}

// GET /api/v1/home/sections/:type — 섹션 더보기 (popular · new · recommend · low-stock · upcoming)
export async function getHomeSection(req, res) {
  // TODO: home.service.js 호출
  notImplemented(res);
}
