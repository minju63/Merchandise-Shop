import { Router } from 'express';
import { map } from '../controllers/storeMap.controller.js';
import * as controller from '../controllers/store.controller.js';
import * as reviewController from '../controllers/review.controller.js';
import * as inquiryController from '../controllers/storeInquiry.controller.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();
router.get('/map', map);
router.get('/', controller.list);
router.get('/:storeId', controller.detail);
router.get('/:storeId/business-hours', controller.hours);
router.get('/:storeId/pickup-info', controller.pickup);
router.get('/:storeId/delivery-info', controller.delivery);
router.get('/:storeId/products', controller.products);
router.get('/:storeId/reviews', reviewController.optionalViewer, reviewController.list);
router.post('/:storeId/reviews', reviewController.requireUser, reviewController.createStoreReview);
router.get('/:storeId/reviewable-items', reviewController.requireUser, reviewController.eligible);
router.get('/:storeId/inquiries', optionalAuth, inquiryController.list);
router.post('/:storeId/inquiries', requireAuth, inquiryController.create);
router.patch('/:storeId/inquiries/:inquiryId', requireAuth, inquiryController.update);
router.delete('/:storeId/inquiries/:inquiryId', requireAuth, inquiryController.remove);
router.put('/:storeId/inquiries/:inquiryId/answer', requireAuth, inquiryController.answer);

export default router;
