// 담당: 민주
// 홈 API — client.js의 axios 인스턴스로 호출
import client from './client.js';

// TODO:
//   GET    /home/sections/:type  섹션 더보기 (popular · new · recommend · low-stock · upcoming)
export const homeApi = {
  get: () => client.get('/home'),
  ad: (bannerId) => client.get(`/home/banners/${bannerId}`),
  adProducts: (bannerId, params) => client.get(`/home/banners/${bannerId}/products`, { params }),
  serviceIntro: (bannerId) => client.get(`/home/service-intro/${bannerId}`),
  exhibition: (bannerId, params) => client.get(`/home/exhibitions/${bannerId}`, { params }),
};

export const bannerApi = {
  click: (bannerId) => client.post(`/banners/${bannerId}/click`),
};
