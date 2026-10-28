export const homeMockUserState = {
  isAuthenticated: true,
  interestCategoryIds: ['idol', 'photocard'],
};

// 홈 섹션 데이터(배너·상품)는 GET /home 응답을 사용한다. 아래는 아직 API가 없는 값만 남긴 임시 데이터.
export const homeMockData = {
  badges: { notifications: 3, cart: 2 },
};
