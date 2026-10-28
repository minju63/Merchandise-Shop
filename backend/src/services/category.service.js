import * as categoryRepository from '../repositories/category.repository.js';

function failure(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

// Repository contract:
// findAll({ type?, contentCategoryId? }) -> Category[] ordered for display.
// findByIds(ids) -> Category[]. Database errors must be thrown by the Repository.
export function createCategoryService(repository) {
  function requireMethod(name) {
    if (typeof repository[name] !== 'function') {
      throw failure(
        `Category Repository의 ${name} 구현이 필요합니다.`,
        503,
        'DEPENDENCY_NOT_READY'
      );
    }
  }

  async function getCategories({ type, contentCategoryId } = {}) {
    if (type !== undefined && !['CONTENT', 'GOODS'].includes(type)) {
      throw failure('type은 CONTENT 또는 GOODS여야 합니다.', 400, 'INVALID_CATEGORY_TYPE');
    }
    requireMethod('findAll');
    if (
      contentCategoryId !== undefined &&
      (type !== 'GOODS' ||
        typeof contentCategoryId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contentCategoryId))
    ) {
      throw failure('콘텐츠 카테고리 조건을 확인해 주세요.', 400, 'INVALID_REQUEST');
    }
    return repository.findAll({ type, contentCategoryId });
  }

  // Call before replacing product_categories during product registration/update.
  // The writer must enforce this invariant transactionally to prevent concurrent duplicates.
  async function validateProductCategories(categoryIds) {
    if (
      !Array.isArray(categoryIds) ||
      categoryIds.length !== 2 ||
      categoryIds.some((id) => typeof id !== 'string' || !id) ||
      new Set(categoryIds).size !== 2
    ) {
      throw failure(
        'CONTENT와 GOODS 카테고리를 각각 하나씩 선택해 주세요.',
        400,
        'INVALID_PRODUCT_CATEGORIES'
      );
    }
    requireMethod('findByIds');
    const categories = await repository.findByIds(categoryIds);
    if (
      categories.length !== 2 ||
      !categoryIds.every((id) => categories.some((category) => category.id === id)) ||
      categories.filter((category) => category.type === 'CONTENT').length !== 1 ||
      categories.filter((category) => category.type === 'GOODS').length !== 1
    ) {
      throw failure(
        'CONTENT와 GOODS 카테고리가 각각 하나씩 필요합니다.',
        400,
        'INVALID_PRODUCT_CATEGORIES'
      );
    }
    return categories;
  }

  return {
    getCategories,
    getContentCategories: () => getCategories({ type: 'CONTENT' }),
    getGoodsCategories: () => getCategories({ type: 'GOODS' }),
    validateProductCategories,
  };
}

const service = createCategoryService(categoryRepository);
export const getCategories = service.getCategories;
export const getContentCategories = service.getContentCategories;
export const getGoodsCategories = service.getGoodsCategories;
export const validateProductCategories = service.validateProductCategories;
