import * as categoryService from '../services/category.service.js';

// Service contract: getCategories({ type?: 'CONTENT' | 'GOODS' }).
export async function getCategories(req, res, next) {
  const { type, contentCategoryId } = req.query;

  if (type !== undefined && !['CONTENT', 'GOODS'].includes(type)) {
    return res.status(400).json({
      success: false,
      data: null,
      message: 'type은 CONTENT 또는 GOODS여야 합니다.',
      code: 'INVALID_REQUEST',
    });
  }

  if (
    contentCategoryId !== undefined &&
    (type !== 'GOODS' ||
      typeof contentCategoryId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contentCategoryId))
  ) {
    return res
      .status(400)
      .json({
        success: false,
        data: null,
        message: 'GOODS 조회의 contentCategoryId는 UUID여야 합니다.',
        code: 'INVALID_REQUEST',
      });
  }
  try {
    const data = await categoryService.getCategories({ type, contentCategoryId });
    return res.status(200).json({ success: true, data, message: null });
  } catch (error) {
    return next(error);
  }
}
