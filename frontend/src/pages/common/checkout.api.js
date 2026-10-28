import { http } from '../my/my.api.js';

const data = (response) => response.data.data;

export const previewCheckout = (body) => http.post('/checkout/preview', body).then(data);
export const submitCheckout = (body) => http.post('/checkout', body).then(data);
export const getCheckoutResult = (groupId) => http.get(`/checkout/${groupId}`).then(data);
