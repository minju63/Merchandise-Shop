import { logSearch } from '../services/search.service.js';

export async function postSearchLog(req, res) {
  const searchLog = await logSearch({
    userId: req.user?.id,
    query: req.body.query,
    resultCount: req.body.resultCount,
    regionId: req.body.regionId,
  });

  res.status(201).json({ success: true, data: searchLog, message: null });
}
