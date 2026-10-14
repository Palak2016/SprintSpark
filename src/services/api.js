import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to catch global errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error intercepted:', error.response || error.message);
    return Promise.reject(error);
  }
);

export default api;