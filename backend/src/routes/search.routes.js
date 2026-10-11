// 담당: 민주
// 검색 — /api/v1/search (prefix는 routes/index.js에서 등록)
import { Router } from 'express';
import {
  deleteRecentSearches,
  getPopularSearches,
  getRecentSearches,
  getSearch,
  getSearchProducts,
  getSearchSuggest,
  postSearchLog,
} from '../controllers/search.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', getSearch); // 통합 검색
router.get('/products', getSearchProducts); // 상품 검색 (구현됨)
router.get('/suggest', getSearchSuggest); // 자동완성
router.get('/popular', getPopularSearches); // 인기 검색어
router.get('/recent', getRecentSearches); // 최근 검색어 🔒
router.delete('/recent', deleteRecentSearches); // 최근 검색어 삭제 🔒
router.post('/logs', optionalAuth, postSearchLog); // 검색 로그 (구현됨)

export default router;
