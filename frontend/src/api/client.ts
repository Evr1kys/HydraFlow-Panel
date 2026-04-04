import axios from 'axios';

const api = axios.create({ baseURL: '/api', headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('hydraflow_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('hydraflow_refresh');
      if (refreshToken && !error.config._retry) {
        error.config._retry = true;
        try {
          const res = await axios.post('/api/auth/refresh', { refreshToken });
          localStorage.setItem('hydraflow_token', res.data.accessToken);
          localStorage.setItem('hydraflow_refresh', res.data.refreshToken);
          error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return api(error.config);
        } catch {
          localStorage.removeItem('hydraflow_token');
          localStorage.removeItem('hydraflow_refresh');
          window.location.href = '/login';
        }
      } else {
        localStorage.removeItem('hydraflow_token');
        localStorage.removeItem('hydraflow_refresh');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export { api };
