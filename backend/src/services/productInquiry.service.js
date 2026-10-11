import * as productInquiryRepository from '../repositories/productInquiry.repository.js';
import * as productService from './product.service.js';

function failure(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

// Repository contract:
// findByStoreId(id, { page, size, userId }) -> { items, totalCount }.
// Scope to validated store_id AND authenticated user_id AND category=PRODUCT.
// create({ store_id, user_id, content, title }) -> created inquiry.
// PRODUCT/PENDING are set by the Repository; no schema changes are required.
export function createProductInquiryService({ repository, products }) {
  function requireMethod(name) {
    if (typeof repository[name] !== 'function') {
      throw failure(`문의 Repository의 ${name} 구현이 필요합니다.`, 503, 'DEPENDENCY_NOT_READY');
    }
  }

  async function validateInquiryTarget(storeProductId) {
    // Detail validation blocks absent/HIDDEN/DELETED listings. An operating pause
    // restricts purchases but does not hide the listing or prevent product questions.
    return products.getProductDetail(storeProductId);
  }

  async function getProductInquiries(storeProductId, { page = 1, size = 20, userId } = {}) {
    if (!userId) return { items: [], page, size, totalCount: 0 };
    const target = await validateInquiryTarget(storeProductId);
    requireMethod('findByStoreId');
    const { items, totalCount } = await repository.findByStoreId(target.storeId, {
      page,
      size,
      userId,
    });
    return { items, page, size, totalCount };
  }

  async function createProductInquiry({ storeProductId, userId, content, title } = {}) {
    if (!userId) throw failure('로그인이 필요합니다.', 401, 'UNAUTHORIZED');
    if (
      typeof content !== 'string' ||
      !content.trim() ||
      typeof title !== 'string' ||
      !title.trim() ||
      Array.from(title.trim()).length > 100
    ) {
      throw failure('문의 내용을 확인해 주세요.', 400, 'INVALID_REQUEST');
    }
    const target = await validateInquiryTarget(storeProductId);
    requireMethod('create');
    const input = {
      store_id: target.storeId,
      user_id: userId,
      content: content.trim(),
      title: title.trim(),
    };
    return repository.create(input);
  }

  return { getProductInquiries, createProductInquiry, validateInquiryTarget };
}

const service = createProductInquiryService({
  repository: productInquiryRepository,
  products: productService,
});
export const getProductInquiries = service.getProductInquiries;
export const createProductInquiry = service.createProductInquiry;
export const validateInquiryTarget = service.validateInquiryTarget;
