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
    const target = await validateInquiryTarget(storeProductId);
    const samples = typeof repository.findDemoByStoreId === 'function'
      ? await repository.findDemoByStoreId(target.storeId) : [];
    if (!userId) return { items: [], samples, page, size, totalCount: 0 };
    requireMethod('findByStoreId');
    const { items, totalCount } = await repository.findByStoreId(target.storeId, {
      page,
      size,
      userId,
    });
    return { items, samples, page, size, totalCount };
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

  function checkText(title, content) {
    if (
      typeof content !== 'string' ||
      !content.trim() ||
      typeof title !== 'string' ||
      !title.trim() ||
      Array.from(title.trim()).length > 100
    ) {
      throw failure('문의 제목(100자 이내)과 내용을 확인해 주세요.', 400, 'INVALID_REQUEST');
    }
  }

  async function updateProductInquiry({ storeProductId, inquiryId, userId, content, title } = {}) {
    if (!userId) throw failure('로그인이 필요합니다.', 401, 'UNAUTHORIZED');
    checkText(title, content);
    const target = await validateInquiryTarget(storeProductId);
    requireMethod('update');
    const updated = await repository.update({ id: inquiryId, store_id: target.storeId, user_id: userId, title, content });
    if (!updated) {
      throw failure('수정할 수 없는 문의예요. 매장이 답변했거나 이미 삭제된 문의일 수 있어요.', 409, 'INQUIRY_NOT_EDITABLE');
    }
    return updated;
  }

  async function deleteProductInquiry({ storeProductId, inquiryId, userId } = {}) {
    if (!userId) throw failure('로그인이 필요합니다.', 401, 'UNAUTHORIZED');
    const target = await validateInquiryTarget(storeProductId);
    requireMethod('remove');
    const removed = await repository.remove({ id: inquiryId, store_id: target.storeId, user_id: userId });
    if (!removed) throw failure('삭제할 문의를 찾을 수 없어요.', 404, 'INQUIRY_NOT_FOUND');
    return { id: inquiryId };
  }

  return { getProductInquiries, createProductInquiry, updateProductInquiry, deleteProductInquiry, validateInquiryTarget };
}

const service = createProductInquiryService({
  repository: productInquiryRepository,
  products: productService,
});
export const getProductInquiries = service.getProductInquiries;
export const createProductInquiry = service.createProductInquiry;
export const updateProductInquiry = service.updateProductInquiry;
export const deleteProductInquiry = service.deleteProductInquiry;
export const validateInquiryTarget = service.validateInquiryTarget;
