import { createSearchLog } from '../repositories/search.repository.js';

export async function logSearch({ userId, query, resultCount, regionId }) {
  const normalizedQuery = typeof query === 'string' ? query.trim() : '';
  if (!normalizedQuery || normalizedQuery.length > 200) {
    const error = new Error('검색어는 1자 이상 200자 이하여야 합니다.');
    error.status = 400;
    throw error;
  }

  if (!Number.isInteger(resultCount) || resultCount < 0) {
    const error = new Error('검색 결과 수가 올바르지 않습니다.');
    error.status = 400;
    throw error;
  }

  return createSearchLog({
    userId,
    query: normalizedQuery,
    resultCount,
    regionId,
  });
}
