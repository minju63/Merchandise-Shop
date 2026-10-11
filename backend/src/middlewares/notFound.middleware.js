// 담당: 공용
// 404 — Express 5에서는 app.get('*') 대신 app.use() 사용
export function notFound(req, res) {
  res.status(404).json({
    success: false,
    data: null,
    message: '요청한 API를 찾을 수 없습니다.',
    code: 'NOT_FOUND',
  });
}
