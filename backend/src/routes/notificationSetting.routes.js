import { Router } from 'express';
import * as controller from '../controllers/notificationSetting.controller.js';
import { authenticate } from '../services/auth.service.js';
import { fail } from '../utils/response.js';

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

router.get('/', requireAuthentication, controller.getMyNotificationSettings);
router.patch('/', requireAuthentication, controller.updateMyNotificationSettings);

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
