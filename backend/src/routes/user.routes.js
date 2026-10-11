import { Router } from 'express';
import * as controller from '../controllers/user.controller.js';
import { authenticate } from '../services/auth.service.js';
import { fail } from '../utils/response.js';

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

async function requireAuthentication(req, res, next) {
  try {
    // 공용 인증 파일은 수정하지 않고 1단계의 실제 Supabase Auth 검증을 재사용한다.
    res.locals.authUser = await authenticate(req.get('Authorization'));
    next();
  } catch (error) {
    next(error);
  }
}

router.get('/me/agreements', requireAuthentication, controller.getMyAgreements);
router.get('/me', requireAuthentication, controller.getMySummary);
router.patch('/me', requireAuthentication, controller.updateMyProfile);
router.delete('/me', requireAuthentication, controller.withdrawAccount);

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
