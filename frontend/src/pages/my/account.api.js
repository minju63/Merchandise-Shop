import { http } from './my.api.js';

const data = (response) => response.data.data;

// 멤버십
export const listPlans = () => http.get('/memberships/plans').then(data);
export const getMyMembership = () => http.get('/memberships/me').then(data);
export const subscribeMembership = (body) => http.post('/memberships', body).then(data);
export const cancelMembership = () => http.post('/memberships/me/cancel', {}).then(data);

// 쿠폰
export const listCoupons = () => http.get('/coupons').then(data);
export const getCoupon = (id) => http.get(`/coupons/${id}`).then(data);
export const registerCoupon = (code) => http.post('/coupons/register', { code }).then(data);

// 배송지
export const listAddresses = () => http.get('/addresses').then(data);
export const createAddress = (body) => http.post('/addresses', body).then(data);
export const updateAddress = (id, body) => http.patch(`/addresses/${id}`, body).then(data);
export const deleteAddress = (id) => http.delete(`/addresses/${id}`).then(data);
export const setDefaultAddress = (id) => http.patch(`/addresses/${id}/default`, {}).then(data);
export const changeOrderAddress = (orderId, addressId) =>
  http.patch(`/orders/${orderId}/address`, { addressId }).then(data);

// 결제수단
export const listPaymentMethods = () => http.get('/payment-methods').then(data);
export const createPaymentMethod = (body) => http.post('/payment-methods', body).then(data);
export const deletePaymentMethod = (id) => http.delete(`/payment-methods/${id}`).then(data);
export const setDefaultPaymentMethod = (id) =>
  http.patch(`/payment-methods/${id}/default`, {}).then(data);

// 알림 설정
export const getNotificationSettings = () => http.get('/notification-settings').then(data);
export const updateNotificationSettings = (body) =>
  http.patch('/notification-settings', body).then(data);

// 개인정보
export const getMyProfile = () => http.get('/users/me').then(data);
export const updateMyProfile = (body) => http.patch('/users/me', body).then(data);
export const getMyAgreements = (params) =>
  http.get('/users/me/agreements', { params }).then(data);
export const withdrawAccount = () => http.delete('/users/me').then(data);

// 고객센터
export const listFaqs = (params) => http.get('/faqs', { params }).then(data);
export const listNotices = (params) => http.get('/notices', { params }).then(data);
export const getNotice = (id) => http.get(`/notices/${id}`).then(data);
export const listInquiries = () => http.get('/inquiries').then(data);
export const createInquiry = (body) => http.post('/inquiries', body).then(data);
export const updateInquiry = (id, body) => http.patch(`/inquiries/${id}`, body).then(data);
export const deleteInquiry = (id) => http.delete(`/inquiries/${id}`).then(data);
export const listReports = () => http.get('/reports').then(data);

// 리뷰
export const createReview = (body) => http.post('/reviews', body).then(data);

// 입점 신청
export const getMySellerApplication = () => http.get('/seller-applications/me').then(data);
export const submitSellerApplication = (body) => http.post('/seller-applications', body).then(data);

// 적립금 · 반품/교환 · 최근 본 상품 · 알림 신청 · 응원배너
export const getMyPoints = () => http.get('/users/me/points').then(data);
export const listClaims = () => http.get('/orders/claims').then(data);
export const createClaim = (orderId, body) => http.post(`/orders/${orderId}/claims`, body).then(data);
export const getRecentProducts = () => http.get('/users/me/recent-products').then(data);
export const recordProductView = (storeProductId) =>
  http.post('/users/me/recent-products', { storeProductId }).then(data);
export const listPreorders = () => http.get('/preorders', { params: { page: 1, size: 50 } }).then(data);
export const listRestockAlerts = () =>
  http.get('/restock-alerts', { params: { page: 1, size: 50 } }).then(data);
export const listOpenAlerts = () => http.get('/users/me/open-alerts').then(data);
export const getFanBannerBoard = (params) =>
  http.get('/users/me/fan-banners/board', { params }).then(data);
export const listFanBannerEntries = () => http.get('/users/me/fan-banners').then(data);
export const createFanBannerEntry = (body) => http.post('/users/me/fan-banners', body).then(data);
