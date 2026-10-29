export const homeMockUserState = {
  isAuthenticated: true,
  interestCategoryIds: ['idol', 'photocard'],
};

// 홈 섹션 데이터(배너·상품)는 GET /home 응답을 사용한다. 아래는 아직 API가 없는 값만 남긴 임시 데이터.
export const homeMockData = {
  // 알림·장바구니 개수는 API가 연결되기 전까지 0으로 두고, 0이면 배지를 보여주지 않는다.
  badges: { notifications: 0, cart: 0 },
};
