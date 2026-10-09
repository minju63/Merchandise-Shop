import { Router } from 'express';
import { postSearchLog } from '../controllers/search.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/search/logs', optionalAuth, postSearchLog);

export default router;
