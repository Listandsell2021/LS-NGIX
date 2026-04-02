import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Don't retry auth endpoints
    const isAuthRequest = originalRequest.url?.startsWith('/auth/');
    if (isAuthRequest) {
      return Promise.reject(error);
    }

    // On 401, try to refresh the token once
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        return api(originalRequest);
      } catch {
        // Refresh failed — just reject, useAuth handles the state
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
