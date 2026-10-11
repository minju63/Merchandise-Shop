import * as productInquiryService from '../services/productInquiry.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function reject(res, message, status = 400, code = 'INVALID_REQUEST') {
  return res.status(status).json({ success: false, data: null, message, code });
}

function validId(value) {
  return typeof value === 'string' && UUID.test(value);
}

function parseInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

// Service contract: getProductInquiries(storeProductId, { page, size, userId }).
export async function getProductInquiries(req, res, next) {
  const { storeProductId } = req.params;
  if (!validId(storeProductId)) return reject(res, 'storeProductId는 UUID여야 합니다.');

  const page = parseInteger(req.query.page, 1);
  const size = parseInteger(req.query.size, 20, 100);
  if (page === null || size === null) {
    return reject(res, 'page는 양의 정수, size는 1~100의 정수여야 합니다.');
  }

  try {
    const data = await productInquiryService.getProductInquiries(storeProductId, {
      page,
      size,
      userId: req.user?.id,
    });
    return res.status(200).json({ success: true, data, message: null });
  } catch (error) {
    return next(error);
  }
}

// Authentication middleware must populate req.user from a verified access token.
// Service contract: createProductInquiry({ storeProductId, userId, content, title? }).
export async function createProductInquiry(req, res, next) {
  const userId = req.user?.id;
  if (!validId(userId)) return reject(res, '로그인이 필요합니다.', 401, 'UNAUTHORIZED');

  const { storeProductId } = req.params;
  if (!validId(storeProductId)) return reject(res, 'storeProductId는 UUID여야 합니다.');

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || typeof body.content !== 'string' || !body.content.trim()) {
    return reject(res, '문의 내용을 입력해 주세요.');
  }
  if (body.title !== undefined && (typeof body.title !== 'string' || !body.title.trim())) {
    return reject(res, '문의 제목은 비어 있지 않은 문자열이어야 합니다.');
  }

  const input = { storeProductId, userId, content: body.content.trim() };
  if (body.title !== undefined) input.title = body.title.trim();

  try {
    const data = await productInquiryService.createProductInquiry(input);
    return res.status(201).json({ success: true, data, message: null });
  } catch (error) {
    return next(error);
  }
}
