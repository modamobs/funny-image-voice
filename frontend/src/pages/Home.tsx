import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImages, uploadImage, previewAiImage, confirmAiImage, IMAGE_URL } from '../api';
import type { ImageItem } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';

export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [genError, setGenError] = useState('');
  const [preview, setPreview] = useState<{ filename: string; prompt: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, loading, login, logout } = useAuth();
  const isMobile = useIsMobile();

  const load = async () => {
    const res = await getImages();
    setImages(res.data);
  };

  useEffect(() => { load(); }, []);

  const handleAiGenerate = async () => {
    if (!user) { login(); return; }
    setGenerating(true);
    setGenError('');
    try {
      const res = await previewAiImage();
      setPreview(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'AI 이미지 생성에 실패했습니다';
      setGenError(msg);
      setTimeout(() => setGenError(''), 4000);
    } finally {
      setGenerating(false);
    }
  };

  const handleAiConfirm = async () => {
    if (!preview) return;
    setConfirming(true);
    try {
      const res = await confirmAiImage(preview.filename, preview.prompt);
      setPreview(null);
      await load();
      navigate(`/image/${res.data.id}`);
    } finally {
      setConfirming(false);
    }
  };

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
      <div style={{ background: '#4338ca', padding: isMobile ? '14px 16px' : '20px 24px', color: '#fff' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: isMobile ? '18px' : '24px', whiteSpace: 'nowrap' }}>🎤 이미지 개그 대결</h1>
            {!isMobile && <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: '14px' }}>이미지를 올리고 웃긴 멘트를 달아보세요!</p>}
          </div>
          {!loading && (
            user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <img src={user.picture} alt={user.name} onClick={() => navigate('/profile')} style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', cursor: 'pointer', flexShrink: 0 }} />
                {!isMobile && <span style={{ fontSize: '14px', fontWeight: 600 }}>{user.name}</span>}
                {user.is_admin && (
                  <button onClick={() => navigate('/admin')} style={{ padding: '5px 10px', borderRadius: '20px', border: '1.5px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                    🛠{!isMobile && ' 관리'}
                  </button>
                )}
                <button onClick={logout} style={{ padding: '5px 10px', borderRadius: '20px', border: '1.5px solid rgba(255,255,255,0.5)', background: 'transparent', color: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                  {isMobile ? '로그아웃' : '로그아웃'}
                </button>
              </div>
            ) : (
              <button onClick={login} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: '#fff', color: '#4338ca', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 14, height: 14 }} />
                Google 로그인
              </button>
            )
          )}
        </div>
      </div>

      {/* 업로드 / AI 생성 버튼 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: isMobile ? '20px 16px 12px' : '32px 16px 16px' }}>
        <div style={{ display: 'flex', gap: '10px', width: isMobile ? '100%' : 'auto', flexWrap: isMobile ? undefined : 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || generating}
            style={{
              padding: isMobile ? '13px 0' : '14px 32px',
              flex: isMobile ? 1 : undefined,
              borderRadius: '50px', border: 'none',
              background: uploading ? '#9ca3af' : '#6366f1', color: '#fff',
              fontSize: '15px', cursor: uploading || generating ? 'not-allowed' : 'pointer',
              fontWeight: 700, boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
            }}
          >
            {uploading ? '업로드 중...' : '📸 이미지 올리기'}
          </button>

          <button
            onClick={handleAiGenerate}
            disabled={generating || uploading}
            style={{
              padding: isMobile ? '13px 0' : '14px 32px',
              flex: isMobile ? 1 : undefined,
              borderRadius: '50px', border: 'none',
              background: generating ? '#9ca3af' : 'linear-gradient(135deg, #f59e0b, #ef4444)',
              color: '#fff', fontSize: '15px',
              cursor: generating || uploading ? 'not-allowed' : 'pointer',
              fontWeight: 700, boxShadow: '0 4px 14px rgba(245,158,11,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}
          >
            {generating ? (
              <>
                <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                생성 중...
              </>
            ) : '🤖 AI 이미지 생성'}
          </button>
        </div>
        {genError && (
          <p style={{ margin: 0, color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>{genError}</p>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />

      {/* AI 이미지 미리보기 모달 */}
      {preview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', overflow: 'hidden', maxWidth: '480px', width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,0.4)' }}>
            <img src={IMAGE_URL(preview.filename)} alt="AI 생성 이미지" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
            <div style={{ padding: '20px 24px 24px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleAiConfirm}
                  disabled={confirming}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: confirming ? '#9ca3af' : '#6366f1', color: '#fff', fontSize: '15px', fontWeight: 700, cursor: confirming ? 'not-allowed' : 'pointer' }}
                >
                  {confirming ? '올리는 중...' : '✅ 올리기'}
                </button>
                <button
                  onClick={handleAiGenerate}
                  disabled={generating || confirming}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: '15px', fontWeight: 700, cursor: generating || confirming ? 'not-allowed' : 'pointer' }}
                >
                  {generating ? '생성 중...' : '🔄 다시 생성'}
                </button>
                <button
                  onClick={() => setPreview(null)}
                  disabled={confirming}
                  style={{ padding: '12px 16px', borderRadius: '12px', border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#9ca3af', fontSize: '15px', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 그리드 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: isMobile ? '12px' : '20px',
          padding: isMobile ? '12px 12px 40px' : '16px 24px 40px',
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
              style={{ width: '100%', height: isMobile ? '140px' : '200px', objectFit: 'cover', display: 'block' }}
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
