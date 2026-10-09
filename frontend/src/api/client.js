import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api/v1',
  timeout: 12000,
});
client.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const result = new Error(error.response?.data?.message || '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    result.status = error.response?.status;
    result.code = error.response?.data?.code;
    return Promise.reject(result);
  }
);
export default client;
