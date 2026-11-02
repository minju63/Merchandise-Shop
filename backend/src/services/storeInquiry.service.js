import { storeInquiryRepository } from '../repositories/storeInquiry.repository.js';

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const inquiryError = (status, code, message) =>
  Object.assign(new Error(message), { status, code });
export function requireInquiryId(id) {
  if (typeof id !== 'string' || !UUID.test(id))
    throw inquiryError(400, 'INVALID_PARAMETER', '올바른 ID가 아닙니다.');
}
function text(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > max) {
    throw inquiryError(400, 'INVALID_REQUEST', `${label}은 1~${max}자로 입력해 주세요.`);
  }
  return value.trim();
}

export function createStoreInquiryService(repository) {
  async function target(storeId) {
    requireInquiryId(storeId);
    const store = await repository.getStore(storeId);
    if (!store || store.status !== 'ACTIVE')
      throw inquiryError(404, 'STORE_NOT_FOUND', '이용 가능한 굿즈샵을 찾을 수 없습니다.');
    return store;
  }
  async function member(user) {
    if (!user?.id || user.is_anonymous)
      throw inquiryError(401, 'AUTH_REQUIRED', '로그인 후 이용해 주세요.');
    requireInquiryId(user.id);
    const profile = await repository.getMember(user.id);
    if (profile?.status !== 'ACTIVE')
      throw inquiryError(403, 'MEMBER_REQUIRED', '이용 가능한 회원 계정이 필요합니다.');
    return profile;
  }
  return {
    async list(storeId, { page = 1, size = 10, userId } = {}) {
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(size) ||
        size < 1 ||
        size > 100 ||
        !Number.isSafeInteger(page * size)
      ) {
        throw inquiryError(400, 'INVALID_PARAMETER', '페이지 범위를 확인해 주세요.');
      }
      const store = await target(storeId);
      const result = await repository.list(storeId, { page, size, userId });
      return { ...result, store: { id: store.id, name: store.name }, page, size };
    },
    async create(storeId, user, body) {
      await member(user);
      const title = text(body?.title, 100, '문의 제목');
      const content = text(body?.content, 5000, '문의 내용');
      requireInquiryId(body?.requestId);
      const store = await target(storeId);
      return repository.create({
        store_id: store.id,
        user_id: user.id,
        request_id: body.requestId,
        title,
        content,
      });
    },
    async update(storeId, inquiryId, user, body) {
      await member(user);
      requireInquiryId(inquiryId);
      const title = text(body?.title, 100, '문의 제목');
      const content = text(body?.content, 5000, '문의 내용');
      await target(storeId);
      const row = await repository.updatePending(storeId, inquiryId, user.id, { title, content });
      if (!row)
        throw inquiryError(
          409,
          'INQUIRY_NOT_EDITABLE',
          '본인의 답변대기 문의만 수정할 수 있습니다. 이미 답변이 등록되었거나 삭제된 문의인지 확인해 주세요.'
        );
      return row;
    },
    async remove(storeId, inquiryId, user) {
      await member(user);
      requireInquiryId(inquiryId);
      await target(storeId);
      const row = await repository.removePending(storeId, inquiryId, user.id);
      if (!row)
        throw inquiryError(
          409,
          'INQUIRY_NOT_EDITABLE',
          '본인의 답변대기 문의만 삭제할 수 있습니다. 이미 답변이 등록되었거나 삭제된 문의인지 확인해 주세요.'
        );
      return row;
    },
    async answer(storeId, inquiryId, user, body) {
      const profile = await member(user);
      requireInquiryId(inquiryId);
      const content = text(body?.content, 5000, '답변 내용');
      const store = await target(storeId);
      if (store.owner_id !== user.id || !['SELLER', 'ADMIN'].includes(profile.role))
        throw inquiryError(
          403,
          'STORE_OWNER_REQUIRED',
          '해당 굿즈샵의 판매자만 답변할 수 있습니다.'
        );
      const row = await repository.answer(storeId, inquiryId, user.id, content);
      if (!row)
        throw inquiryError(404, 'INQUIRY_NOT_FOUND', '해당 굿즈샵의 문의를 찾을 수 없습니다.');
      return row;
    },
  };
}

export const storeInquiryService = createStoreInquiryService(storeInquiryRepository);
