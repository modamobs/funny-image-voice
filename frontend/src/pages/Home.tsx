import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImages, uploadImage, previewAiImage, confirmAiImage, IMAGE_URL } from '../api';
import type { ImageItem } from '../types';
import { useAuth } from '../hooks/useAuth';
import { useIsMobile } from '../hooks/useIsMobile';
import TodayRound from '../components/TodayRound';

// 백엔드에서 무료 제공을 중단한 기능. 다시 열 때 VITE_AI_IMAGE_ENABLED=true 로 켠다.
const AI_IMAGE_ENABLED = import.meta.env.VITE_AI_IMAGE_ENABLED === 'true';

const today = () => {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

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

  const side = isMobile ? 18 : 56;

  // 지면 위의 작은 보조 버튼 — 관리 · 로그아웃
  const chip: React.CSSProperties = {
    height: 40, padding: '0 12px', cursor: 'pointer',
    border: '2px solid var(--ink)', background: 'var(--panel)', color: 'var(--ink)',
    fontFamily: 'var(--body)', fontSize: '11.5px', fontWeight: 700,
  };

  // PC 에서는 오늘의 판 사이드 하단에, 폰에서는 CTA 아래에 붙는다
  const uploadRow = (
    <div style={{ marginTop: isMobile ? '16px' : 0 }}>
      <div style={{ display: 'flex', gap: '9px' }}>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading || generating}
          style={{
            flex: 1, height: isMobile ? 48 : 46, cursor: uploading || generating ? 'not-allowed' : 'pointer',
            border: '2.5px solid var(--ink)', background: 'var(--panel)', color: 'var(--ink)',
            fontFamily: 'var(--display)', fontSize: '15px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
            opacity: uploading ? 0.5 : 1,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="15" rx="1" />
            <circle cx="12" cy="12" r="3.5" />
            <path d="M8 5l1.5-2h5L16 5" />
          </svg>
          {uploading ? '올리는 중...' : '내 짤 올리기'}
        </button>

        {AI_IMAGE_ENABLED && (
          <button
            onClick={handleAiGenerate}
            disabled={generating || uploading}
            style={{
              flex: 1, height: isMobile ? 48 : 46, cursor: generating || uploading ? 'not-allowed' : 'pointer',
              border: '2.5px solid var(--ink)', background: 'var(--amber-tint)', color: 'var(--ink)',
              fontFamily: 'var(--display)', fontSize: '15px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
              opacity: generating ? 0.5 : 1,
            }}
          >
            {generating ? '만드는 중...' : 'AI로 만들기'}
          </button>
        )}
      </div>
      {genError && (
        <p style={{ margin: '9px 0 0', color: '#C9302B', fontSize: '12.5px', fontWeight: 600 }}>{genError}</p>
      )}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', color: 'var(--ink)', fontFamily: 'var(--body)' }}>

      {/* 제호 */}
      <div style={{ borderBottom: '3px solid var(--ink)' }}>
        <div style={{
          maxWidth: '1280px', margin: '0 auto', padding: `15px ${side}px 11px`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
            <h1 style={{
              margin: 0, fontFamily: 'var(--display)', fontWeight: 400,
              fontSize: isMobile ? '18px' : '22px', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
            }}>
              개그대결 호외
            </h1>
            <span style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{today()}</span>
          </div>

          {!loading && (
            user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
                {user.is_admin && (
                  <button onClick={() => navigate('/admin')} style={chip}>관리</button>
                )}
                <button onClick={logout} style={chip}>로그아웃</button>
                <img
                  src={user.picture}
                  alt={user.name}
                  onClick={() => navigate('/profile')}
                  style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
                    border: '2.5px solid var(--ink)', background: 'var(--panel)',
                  }}
                />
              </div>
            ) : (
              <button
                onClick={login}
                style={{
                  ...chip, height: 44, background: 'var(--amber)', fontSize: '12.5px',
                  display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0,
                }}
              >
                <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 13, height: 13 }} />
                Google 로그인
              </button>
            )
          )}
        </div>
      </div>

      {/* 오늘의 짤 — 하루 한 판, 모두가 같은 이미지에 멘트를 단다 */}
      <TodayRound isMobile={isMobile}>{uploadRow}</TodayRound>

      <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />

      {/* AI 이미지 미리보기 */}
      {preview && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(18,16,14,0.78)', zIndex: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{ background: 'var(--panel)', border: '3px solid var(--ink)', maxWidth: '440px', width: '100%', boxShadow: '6px 6px 0 var(--ink)' }}>
            <img src={IMAGE_URL(preview.filename)} alt="AI 생성 이미지" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block', borderBottom: '3px solid var(--ink)' }} />
            <div style={{ padding: '14px', display: 'flex', gap: '8px' }}>
              <button
                onClick={handleAiConfirm}
                disabled={confirming}
                style={{ flex: 2, height: 46, border: '2.5px solid var(--ink)', background: 'var(--amber)', color: 'var(--ink)', fontFamily: 'var(--display)', fontSize: '15px', cursor: confirming ? 'not-allowed' : 'pointer' }}
              >
                {confirming ? '올리는 중...' : '올리기'}
              </button>
              <button
                onClick={handleAiGenerate}
                disabled={generating || confirming}
                style={{ flex: 1, height: 46, border: '2.5px solid var(--ink)', background: 'var(--panel)', color: 'var(--ink)', fontFamily: 'var(--display)', fontSize: '15px', cursor: 'pointer' }}
              >
                {generating ? '...' : '다시'}
              </button>
              <button
                onClick={() => setPreview(null)}
                disabled={confirming}
                style={{ width: 46, height: 46, border: '2.5px solid var(--ink)', background: 'var(--panel)', color: 'var(--muted)', fontSize: '16px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 지난 짤 */}
      <div style={{ maxWidth: isMobile ? '560px' : '1280px', margin: '0 auto', padding: `30px ${side}px 0` }}>
        <div style={{ borderBottom: '2.5px solid var(--ink)', paddingBottom: '6px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--display)', fontSize: '16px' }}>지난 짤</span>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{images.length}개</span>
        </div>
      </div>

      {images.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--faint)', padding: '48px 0 60px', fontSize: '13.5px' }}>
          아직 지난 짤이 없어요
        </div>
      ) : (
        <div
          style={isMobile ? {
            columnCount: 2,
            columnGap: '10px',
            maxWidth: '560px',
            margin: '0 auto',
            padding: `14px ${side}px 44px`,
          } : {
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: '14px',
            maxWidth: '1280px',
            margin: '0 auto',
            padding: `14px ${side}px 44px`,
          }}
        >
          {images.map((img) => (
            <div
              key={img.id}
              onClick={() => navigate(`/image/${img.id}`)}
              style={{
                breakInside: 'avoid',
                marginBottom: isMobile ? '10px' : 0,
                background: 'var(--panel)',
                border: '2.5px solid var(--ink)',
                cursor: 'pointer',
                transition: 'transform 0.12s, box-shadow 0.12s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translate(-3px, -3px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '5px 5px 0 var(--ink)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translate(0, 0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              <img
                src={IMAGE_URL(img.filename)}
                alt={img.original_name}
                loading="lazy"
                style={{ width: '100%', display: 'block', borderBottom: '2.5px solid var(--ink)' }}
              />
              <div style={{ padding: '8px 11px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.4" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0" />
                  <path d="M12 17v4" />
                </svg>
                <span style={{ color: 'var(--muted)', fontSize: '12.5px', fontWeight: 600 }}>
                  멘트 {img.response_count ?? 0}개
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
