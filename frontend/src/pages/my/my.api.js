import axios from 'axios';
import { supabase } from '../../lib/supabase.js';

// 공용 client.js가 비어 있어 마이 화면 전용으로 둔다. 공용이 생기면 이 인스턴스만 교체한다.
export const http = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL });

http.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  if (data.session) config.headers.Authorization = `Bearer ${data.session.access_token}`;
  return config;
});

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// README 8장 형식: 성공 { success, data, message }, 실패 { success:false, data:null, message, code }
http.interceptors.response.use(
  (response) => response,
  (error) => {
    const body = error.response?.data;
    throw new ApiError(
      body?.message ?? '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
      error.response?.status ?? 0,
      body?.code ?? 'NETWORK_ERROR'
    );
  }
);

export async function getMySummary() {
  const response = await http.get('/users/me');
  return response.data.data;
}

export async function listOrders(params) {
  const response = await http.get('/orders', { params });
  return response.data.data;
}

export async function getOrder(orderId) {
  const response = await http.get(`/orders/${orderId}`);
  return response.data.data;
}

export async function getPickupInfo(orderId) {
  const response = await http.get(`/orders/${orderId}/pickup`);
  return response.data.data;
}

export async function cancelOrder(orderId, body) {
  const response = await http.post(`/orders/${orderId}/cancel`, body);
  return response.data.data;
}

export async function getReorderItems(orderId) {
  const response = await http.post(`/orders/${orderId}/reorder`, {});
  return response.data.data;
}
