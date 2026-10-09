import {
  getHomeUpcomingProducts,
  registerOpenAlert,
  unregisterOpenAlert,
} from '../services/upcoming.service.js';

export async function getUpcomingSection(req, res) {
  const items = await getHomeUpcomingProducts();
  res.json({ success: true, data: { items }, message: null });
}

export async function postOpenAlert(req, res) {
  const alert = await registerOpenAlert(req.user.id, req.params.id);
  res.status(201).json({ success: true, data: alert, message: null });
}

export async function deleteOpenAlert(req, res) {
  await unregisterOpenAlert(req.user.id, req.params.id);
  res.status(204).send();
}
