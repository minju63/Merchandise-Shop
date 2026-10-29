// 담당: 연수
// 로그인·회원가입·비밀번호 재설정이 같이 쓰는 입력 규칙.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 영문과 숫자를 함께 포함해 8자 이상
export const isValidPassword = (value) =>
  value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
