import { Router } from 'express';
import { create, requireUser } from '../controllers/review.controller.js';

const router = Router();
router.post('/', requireUser, create);

export default router;
