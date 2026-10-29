// 담당: 연수
// 로그인·회원가입·결제 화면이 쓰는 경로. App.jsx에 등록된 값과 같아야 한다.
export const AUTH_ROUTES = {
  home: '/',
  login: '/login',
  signupTerms: '/signup/terms',
  signupInfo: '/signup/info',
  signupDone: '/signup/done',
  findPassword: '/find-password',
  resetPassword: '/reset-password',
  checkout: '/checkout',
  checkoutComplete: (groupId) => `/checkout/complete/${groupId}`,
};

// 로그인 후 돌아갈 경로. 같은 사이트 안의 경로만 허용하고 로그인 관련 화면은 제외한다.
export function safeReturnPath(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  const path = value.split(/[?#]/)[0];
  const authPaths = [AUTH_ROUTES.login, AUTH_ROUTES.findPassword, AUTH_ROUTES.resetPassword];
  if (path.startsWith('/signup') || authPaths.includes(path)) return null;
  return value;
}
