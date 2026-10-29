// 담당: 연수
import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/email-check', controller.checkEmail);
router.get('/nickname-check', controller.checkNickname);
router.get('/me/exists', requireAuth, controller.getRegistrationState);
router.post('/signup', requireAuth, controller.completeSignup);

export default router;
