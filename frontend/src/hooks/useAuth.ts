import { useState, useEffect } from 'react';
import { getMe, setAuthToken } from '../api';

export interface User {
  id: string;
  name: string;
  email: string;
  picture: string;
  ai_usage_today: number;
  is_admin: boolean;
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
    const ua = navigator.userAgent;
    const isInApp = /KAKAOTALK|NAVER|Line\/|FBAN|FBAV|FB_IAB|Instagram|Twitter|Snapchat/i.test(ua)
      || (/Android/i.test(ua) && /wv/.test(ua));

    const loginUrl = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/auth/google`;

    if (isInApp) {
      // 시스템 브라우저로 열기 시도 (Android intent / iOS universal link 우회)
      const opened = window.open(loginUrl, '_blank');
      if (!opened) {
        // 팝업 차단된 경우 URL 복사 안내
        navigator.clipboard?.writeText(window.location.href).catch(() => {});
        alert('카카오톡·인스타그램 등 앱 내 브라우저에서는 구글 로그인이 차단됩니다.\n\n크롬 또는 사파리에서 이 페이지를 열어 주세요.\n(주소를 클립보드에 복사했습니다)');
      }
      return;
    }

    window.location.href = loginUrl;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setAuthToken(null);
    setUser(null);
  };

  return { user, loading, login, logout };
}
