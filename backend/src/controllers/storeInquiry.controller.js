import { storeInquiryService as service, inquiryError } from '../services/storeInquiry.service.js';

export async function list(req, res) {
  const { page = '1', size = '10' } = req.query;
  if (
    typeof page !== 'string' ||
    !/^[1-9]\d*$/.test(page) ||
    typeof size !== 'string' ||
    !/^[1-9]\d*$/.test(size)
  ) {
    throw inquiryError(400, 'INVALID_PARAMETER', '페이지 범위를 확인해 주세요.');
  }
  res.json({
    success: true,
    data: await service.list(req.params.storeId, {
      page: Number(page),
      size: Number(size),
      userId: req.user?.id,
    }),
    message: null,
  });
}
export async function create(req, res) {
  res.status(201).json({
    success: true,
    data: await service.create(req.params.storeId, req.user, req.body),
    message: null,
  });
}
export async function answer(req, res) {
  res.json({
    success: true,
    data: await service.answer(req.params.storeId, req.params.inquiryId, req.user, req.body),
    message: null,
  });
}
export async function update(req, res) {
  res.json({
    success: true,
    data: await service.update(req.params.storeId, req.params.inquiryId, req.user, req.body),
    message: null,
  });
}
export async function remove(req, res) {
  res.json({
    success: true,
    data: await service.remove(req.params.storeId, req.params.inquiryId, req.user),
    message: null,
  });
}
