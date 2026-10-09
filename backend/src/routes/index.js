import { Router } from 'express';
import storeRoutes from './store.routes.js';
import reviewRoutes from './review.routes.js';

const router = Router();
router.use('/stores', storeRoutes);
router.use('/reviews', reviewRoutes);

export default router;
