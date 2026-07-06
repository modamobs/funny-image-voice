import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImages, uploadImage, IMAGE_URL } from '../api';
import type { ImageItem } from '../types';
import { useAuth } from '../hooks/useAuth';

export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, loading, login, logout } = useAuth();

  const load = async () => {
    const res = await getImages();
    setImages(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadImage(file);
      navigate(`/image/${res.data.id}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* 헤더 */}
      <div style={{ background: '#4338ca', padding: '20px 24px', color: '#fff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px' }}>🎤 이미지 개그 대결</h1>
            <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '14px' }}>이미지를 올리고 웃긴 멘트를 달아보세요!</p>
          </div>
          {!loading && (
            user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img src={user.picture} alt={user.name} style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)' }} />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{user.name}</span>
                <button onClick={logout} style={{ padding: '6px 14px', borderRadius: '20px', border: '1.5px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                  로그아웃
                </button>
              </div>
            ) : (
              <button onClick={login} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', background: '#fff', color: '#4338ca', fontWeight: 700, fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 16, height: 16 }} />
                Google 로그인
              </button>
            )
          )}
        </div>
      </div>

      {/* 업로드 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 16px 16px' }}>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            padding: '16px 40px',
            borderRadius: '50px',
            border: 'none',
            background: uploading ? '#9ca3af' : '#6366f1',
            color: '#fff',
            fontSize: '18px',
            cursor: uploading ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
          }}
        >
          {uploading ? '업로드 중...' : '📸 이미지 올리기'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
      </div>

      {/* 이미지 그리드 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '20px',
          padding: '16px 24px 40px',
          maxWidth: '1100px',
          margin: '0 auto',
        }}
      >
        {images.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#9ca3af', padding: '60px 0' }}>
            <p style={{ fontSize: '48px', margin: 0 }}>🖼</p>
            <p>아직 이미지가 없어요. 첫 번째로 올려보세요!</p>
          </div>
        )}
        {images.map((img) => (
          <div
            key={img.id}
            onClick={() => navigate(`/image/${img.id}`)}
            style={{
              background: '#fff',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.14)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)';
            }}
          >
            <img
              src={IMAGE_URL(img.filename)}
              alt={img.original_name}
              style={{ width: '100%', height: '200px', objectFit: 'cover', display: 'block' }}
            />
            <div style={{ padding: '10px 16px' }}>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
                🎙 멘트 {img.response_count ?? 0}개
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
