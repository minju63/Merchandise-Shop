import { http } from '../my/my.api.js';

const data = (response) => response.data.data;

export const checkEmail = (email) =>
  http.get('/auth/email-check', { params: { email } }).then(data);
export const checkNickname = (nickname) =>
  http.get('/auth/nickname-check', { params: { nickname } }).then(data);
export const getRegistrationState = () => http.get('/auth/me/exists').then(data);
export const completeSignup = (body) => http.post('/auth/signup', body).then(data);
