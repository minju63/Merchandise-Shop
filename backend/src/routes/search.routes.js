import { Router } from 'express';
import { getSearchProducts, postSearchLog } from '../controllers/search.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/search/products', getSearchProducts);
router.post('/search/logs', optionalAuth, postSearchLog);

export default router;
