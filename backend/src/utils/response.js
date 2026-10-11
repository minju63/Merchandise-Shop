// API 응답 형식 (README 8장). 성공은 ok(), 실패는 fail()로만 만든다.
export function ok(data) {
  return { success: true, data, message: null };
}

export function fail(code, message) {
  return { success: false, data: null, message, code };
}
