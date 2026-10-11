import apiClient from './client.js';
import { getCategories } from './category.api.js';

async function test() {
  try {
    const categories = await getCategories({}, apiClient);
    console.log('카테고리 조회 성공:', categories);
  } catch (error) {
    console.error('카테고리 조회 실패:', error);
  }
}

test();