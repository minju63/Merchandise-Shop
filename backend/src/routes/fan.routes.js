// 팬 응원 전광판 — /api/v1/fan (prefix는 routes/index.js에서 등록)
import { Router } from 'express';
import * as controller from '../controllers/fan.controller.js';
import { authenticate } from '../services/auth.service.js';

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

async function requireAuthentication(req, res, next) {
  try {
    res.locals.authUser = await authenticate(req.get('Authorization'));
    next();
  } catch (error) {
    next(error);
  }
}

// 로그인 여부와 상관없이 볼 수 있지만, 로그인했으면 내 정보를 함께 준다.
async function optionalAuthentication(req, res, next) {
  if (req.get('Authorization')) {
    try {
      res.locals.authUser = await authenticate(req.get('Authorization'));
    } catch {
      // 토큰이 잘못돼도 공개 정보는 그대로 보여 준다.
    }
  }
  next();
}

router.get('/week', controller.getPublicWeek);
router.get('/ranking', optionalAuthentication, controller.getRanking);
router.get('/me', requireAuthentication, controller.getMe);
router.get('/results', requireAuthentication, controller.getResults);
router.get('/tickets', requireAuthentication, controller.getTickets);
router.get('/characters', requireAuthentication, controller.listCharacters);
router.get('/anniversary-dates', requireAuthentication, controller.listAnniversaryDates);
router.post('/tickets/cash', requireAuthentication, controller.buyWithCash);
router.post('/tickets/credit', requireAuthentication, controller.buyWithCredit);
router.post('/tickets/:packId/refund', requireAuthentication, controller.refundPack);
router.get('/designs/:designId', requireAuthentication, controller.getDesign);
router.put('/designs/:designId', requireAuthentication, controller.saveDesign);
router.post('/designs/:designId/submit', requireAuthentication, controller.submitDesign);
router.post('/cheers', requireAuthentication, controller.sendCheers);

export default router;
