import { Router } from 'express';
import * as controller from '../controllers/store.controller.js';
import * as reviewController from '../controllers/review.controller.js';

const router = Router();
router.get('/', controller.list);
router.get('/:storeId', controller.detail);
router.get('/:storeId/business-hours', controller.hours);
router.get('/:storeId/pickup-info', controller.pickup);
router.get('/:storeId/delivery-info', controller.delivery);
router.get('/:storeId/products', controller.products);
router.get('/:storeId/reviews', reviewController.optionalViewer, reviewController.list);
router.post('/:storeId/reviews', reviewController.requireUser, reviewController.createStoreReview);
router.get('/:storeId/reviewable-items', reviewController.requireUser, reviewController.eligible);

export default router;
