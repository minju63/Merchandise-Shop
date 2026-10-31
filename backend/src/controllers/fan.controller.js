import * as service from '../services/fan.service.js';
import { ok } from '../utils/response.js';

const handle = (action, status = 200) => async (req, res, next) => {
  try {
    res.status(status).json(ok(await action(req, res)));
  } catch (error) {
    next(error);
  }
};

const userId = (res) => res.locals.authUser?.id;

// GET /api/v1/fan/week — 이번 주 마감 · 전체 응원 수 (로그인 불필요)
export const getPublicWeek = handle(() => service.getPublicWeek());
// GET /api/v1/fan/ranking?slot=&date= — 순위 (로그인하면 내 응원 수도 포함)
export const getRanking = handle((req, res) => service.getRanking(req.query, userId(res)));
// GET /api/v1/fan/me — 응원권 · 적립금 · 오늘 남은 횟수 🔒
export const getMe = handle((req, res) => service.getMe(userId(res)));
// GET /api/v1/fan/results — 가장 최근 정산 결과 🔒
export const getResults = handle((req, res) => service.getResults(userId(res)));
// GET /api/v1/fan/tickets — 내 응원권 묶음 · 적립금 내역 🔒
export const getTickets = handle((req, res) => service.getTickets(userId(res)));
// GET /api/v1/fan/characters?slot=&q= 🔒
export const listCharacters = handle((req) => service.listCharacters(req.query));
// GET /api/v1/fan/anniversary-dates 🔒
export const listAnniversaryDates = handle(() => service.listAnniversaryDates());
// POST /api/v1/fan/tickets/cash — 현금으로 응원권 구매 🔒
export const buyWithCash = handle((req, res) => service.buyWithCash(userId(res), req.body), 201);
// POST /api/v1/fan/tickets/credit — 적립금으로 응원권 구매 🔒
export const buyWithCredit = handle((req, res) => service.buyWithCredit(userId(res), req.body), 201);
// POST /api/v1/fan/tickets/:packId/refund — 미사용 응원권 환불 🔒
export const refundPack = handle((req, res) => service.refundPack(userId(res), req.params.packId));
// POST /api/v1/fan/cheers 🔒
export const sendCheers = handle((req, res) => service.sendCheers(userId(res), req.body), 201);

// GET /api/v1/fan/designs/:designId — 꾸미기 불러오기 🔒
export const getDesign = handle((req, res) => service.getDesign(userId(res), req.params.designId));
// PUT /api/v1/fan/designs/:designId — 임시 저장 🔒
export const saveDesign = handle((req, res) => service.saveDesign(userId(res), req.params.designId, req.body));
// POST /api/v1/fan/designs/:designId/submit — 검수 요청 🔒
export const submitDesign = handle((req, res) => service.submitDesign(userId(res), req.params.designId));
