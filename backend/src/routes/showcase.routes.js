import { Router } from 'express';
import { ok } from '../utils/response.js';
import { optionalAuth, requireAuth } from '../middlewares/auth.middleware.js';
import * as showcase from '../services/showcase.service.js';

const router = Router();
const send = (res, value) => res.json(ok(value));
router.get('/backgrounds', async (_req, res) => send(res, await showcase.backgrounds()));
router.get('/categories', async (_req, res) => send(res, await showcase.categories()));
router.get('/', optionalAuth, async (req, res) => send(res, await showcase.list({
  type: req.query.type || 'PERSONAL', storeId: req.query.storeId, categoryId: req.query.categoryId,
  sort: req.query.sort, page: Number(req.query.page || 1), size: Number(req.query.size || 12),
}, req.user?.id)));
router.get('/mine', requireAuth, async (req, res) => send(res, await showcase.list({
  mine: true, type: req.query.type || 'PERSONAL', storeId: req.query.storeId,
  page: Number(req.query.page || 1), size: Number(req.query.size || 30),
}, req.user.id)));
router.get('/stores/:storeId/products', requireAuth, async (req, res) =>
  send(res, await showcase.products(req.params.storeId, req.user.id)));
router.post('/', requireAuth, async (req, res) => res.status(201).json(ok(await showcase.create(req.body, req.user.id))));
router.get('/:id', optionalAuth, async (req, res) => send(res, await showcase.detail(req.params.id, req.user?.id)));
router.put('/:id', requireAuth, async (req, res) => send(res, await showcase.save(req.params.id, req.body, req.user.id)));
router.delete('/:id', requireAuth, async (req, res) => send(res, await showcase.remove(req.params.id, req.user.id)));
router.put('/:id/like', requireAuth, async (req, res) => send(res, await showcase.like(req.params.id, req.user.id, true)));
router.delete('/:id/like', requireAuth, async (req, res) => send(res, await showcase.like(req.params.id, req.user.id, false)));
router.post('/:id/images', requireAuth, async (req, res) => send(res, await showcase.upload(req.params.id, req.body, req.user.id)));
router.post('/:id/remove-background', requireAuth, async (req, res) => send(res, await showcase.removeBackground(req.params.id, req.body, req.user.id)));
router.post('/:id/products/:productId/remove-background', requireAuth, async (req, res) => send(res, await showcase.removeProductBackground(req.params.id, req.params.productId, req.user.id)));
router.get('/:id/media/:path', optionalAuth, async (req, res) => {
  const { buffer, mime } = await showcase.media(req.params.id, req.params.path, req.user?.id);
  res.set('Content-Type', mime).set('Cache-Control', 'private, no-store').send(buffer);
});
export default router;
