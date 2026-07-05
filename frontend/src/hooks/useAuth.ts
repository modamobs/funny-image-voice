import { useState, useEffect } from 'react';
import { getMe, setAuthToken } from '../api';

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
  ai_usage_today: number;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // URL에서 토큰 처리
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('token');
    const error = params.get('error');

    if (tokenFromUrl) {
      localStorage.setItem('token', tokenFromUrl);
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (error) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    setAuthToken(token);
    getMe(token)
      .then((res) => setUser(res.data))
      .catch(() => { localStorage.removeItem('token'); setAuthToken(null); })
      .finally(() => setLoading(false));
  }, []);

  const login = () => {
    window.location.href = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/auth/google`;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setAuthToken(null);
    setUser(null);
  };

  return { user, loading, login, logout };
}
