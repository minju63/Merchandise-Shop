// 로그인·회원가입·결제 화면이 쓰는 경로. 팀 라우터가 확정되면 이 파일만 맞춘다.
export const AUTH_ROUTES = {
  home: '/',
  login: '/login',
  signupTerms: '/signup',
  signupInfo: '/signup/info',
  signupDone: '/signup/done',
  checkout: '/checkout',
  checkoutComplete: (groupId) => `/checkout/complete/${groupId}`,
};
