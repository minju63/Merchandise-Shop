import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { authenticate } from '../services/auth.service.js';
import { fail } from '../utils/response.js';

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// 공용 인증 미들웨어가 아직 비어 있으므로 담당 라우터 안에서 인증한다.
async function requireAuthentication(req, res, next) {
  try {
    res.locals.authUser = await authenticate(req.get('Authorization'));
    next();
  } catch (error) {
    next(error);
  }
}

router.get('/email-check', controller.checkEmail);
router.get('/nickname-check', controller.checkNickname);
router.get('/me/exists', requireAuthentication, controller.getRegistrationState);
router.post('/signup', requireAuthentication, controller.completeSignup);

// 아직 공용 응답 도구가 없으므로 이 라우터의 응답 계약만 정의한다.
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  const known =
    Number.isInteger(error.status) &&
    typeof error.code === 'string' &&
    status >= 400 &&
    status < 600;
  return res
    .status(known ? status : 500)
    .json(
      fail(
        known ? error.code : 'INTERNAL_ERROR',
        known ? error.message : '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.'
      )
    );
});

export default router;
