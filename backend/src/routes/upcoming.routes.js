import { Router } from 'express';
import {
  deleteOpenAlert,
  getUpcomingSection,
  postOpenAlert,
} from '../controllers/upcoming.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/home/sections/upcoming', getUpcomingSection);
router.post('/products/:id/open-alert', requireAuth, postOpenAlert);
router.delete('/products/:id/open-alert', requireAuth, deleteOpenAlert);

export default router;
