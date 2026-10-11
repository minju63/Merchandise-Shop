export function reviewError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

export function validateReviewInput(input) {
  if (
    !input ||
    typeof input !== 'object' ||
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.orderItemId || '')
  )
    throw reviewError(400, 'INVALID_PARAMETER', '올바른 주문 항목 ID가 필요합니다.');
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    throw reviewError(400, 'INVALID_PARAMETER', '별점은 1~5점이어야 합니다.');
  if (typeof input.content !== 'string' || input.content.trim().length > 2000)
    throw reviewError(400, 'INVALID_PARAMETER', '리뷰 내용은 2000자 이내여야 합니다.');
  if (!Array.isArray(input.images) || input.images.length > 5)
    throw reviewError(400, 'INVALID_PARAMETER', '이미지는 최대 5장까지 첨부할 수 있습니다.');
  return {
    orderItemId: input.orderItemId,
    rating: input.rating,
    content: input.content.trim(),
    images: input.images,
  };
}
