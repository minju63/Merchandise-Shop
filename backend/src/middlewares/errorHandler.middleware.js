// 담당: 공용
// 에러 핸들러 — 반드시 맨 마지막, 인자 4개 고정
// Express 5는 async 핸들러에서 throw된 에러도 여기로 자동 전달됨
export function errorHandler(err, req, res, next) {
  if (!err.status || err.status >= 500) console.error(err);
  res.status(err.status || 500).json({
    success: false,
    data: null,
    message: err.status ? err.message : '서버 오류가 발생했습니다.',
    code: err.code || 'INTERNAL_SERVER_ERROR',
  });
}
