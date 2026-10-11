import { Router } from 'express';
import { getCategories } from '../controllers/category.controller.js';

// Shared route owner: app.use('/api/v1/categories', categoryRouter).
const router = Router();
router.get('/', getCategories);

export default router;
