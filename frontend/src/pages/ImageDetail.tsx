import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getImage, getImages, deleteImage, IMAGE_URL } from '../api';
import type { ImageDetail as ImageDetailType, ImageItem } from '../types';
import CommentSection from '../components/CommentSection';
import { useIsMobile } from '../hooks/useIsMobile';
import { useAuth } from '../hooks/useAuth';

export default function ImageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ImageDetailType | null>(null);
  const [imageList, setImageList] = useState<ImageItem[]>([]);
  const touchStartX = useRef<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteImage(id);
      navigate('/');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const load = async () => {
    if (!id) return;
    const res = await getImage(id);
    setData(res.data);
  };

  useEffect(() => {
    getImages().then(res => setImageList(res.data));
  }, []);

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!stripRef.current || !activeThumbRef.current) return;
    const strip = stripRef.current;
    const thumb = activeThumbRef.current;
    const offset = thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2;
    strip.scrollTo({ left: offset, behavior: 'smooth' });
  }, [id, imageList]);

  const currentIndex = imageList.findIndex(img => img.id === id);
  const prevId = currentIndex > 0 ? imageList[currentIndex - 1].id : null;
  const nextId = currentIndex >= 0 && currentIndex < imageList.length - 1 ? imageList[currentIndex + 1].id : null;

  const goTo = (targetId: string) => navigate(`/image/${targetId}`);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && nextId) goTo(nextId);
      else if (diff < 0 && prevId) goTo(prevId);
    }
    touchStartX.current = null;
  };

  if (!data) return <div style={{ textAlign: 'center', padding: '80px', color: '#6b7280' }}>로딩 중...</div>;

  /* ── 삭제 확인 모달 (공통) ── */
  const DeleteModal = confirmDelete ? (
    <div onClick={() => !deleting && setConfirmDelete(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '20px', padding: '28px 24px 20px', width: '100%', maxWidth: '320px', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827', textAlign: 'center', lineHeight: 1.6 }}>이 이미지를 삭제할까요?<br /><span style={{ fontSize: '13px', color: '#6b7280' }}>댓글과 멘트도 함께 삭제됩니다.</span></p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setConfirmDelete(false)} disabled={deleting} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
          <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: deleting ? '#d1d5db' : '#ef4444', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer' }}>
            {deleting ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  /* ── 썸네일 스트립 (공통) ── */
  const ThumbnailStrip = (
    imageList.length > 1 ? (
      <div
        ref={stripRef}
        style={{
          display: 'flex', gap: '8px',
          padding: isMobile ? '6px 16px 12px' : '6px 20px 16px',
          overflowX: 'auto', flexShrink: 0,
          scrollbarWidth: 'none', background: isMobile ? '#f9fafb' : 'transparent',
        }}
      >
        {imageList.map(img => {
          const isActive = img.id === id;
          return (
            <button
              key={img.id}
              ref={isActive ? activeThumbRef : null}
              onClick={() => goTo(img.id)}
              style={{
                flexShrink: 0,
                width: isMobile ? 56 : 64, height: isMobile ? 56 : 64,
                padding: 0, border: 'none',
                borderRadius: '10px', overflow: 'hidden', cursor: 'pointer',
                outline: isActive ? '3px solid #4338ca' : '2px solid transparent',
                outlineOffset: '2px',
                opacity: isActive ? 1 : 0.55,
                transition: 'opacity 0.15s, outline 0.15s',
              }}
            >
              <img src={IMAGE_URL(img.filename)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          );
        })}
      </div>
    ) : null
  );

  /* ══════════════ 모바일 레이아웃 ══════════════ */
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f9fafb' }}>
        {DeleteModal}
        {/* 상단 바 */}
        <div style={{ background: '#4338ca', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10 }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
          >
            ← 목록
          </button>
          {currentIndex >= 0 && (
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
              {currentIndex + 1} / {imageList.length}
            </span>
          )}
          {user && data.user_id === user.id && (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.8)', border: 'none', borderRadius: '8px', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
            >
              🗑 삭제
            </button>
          )}
        </div>

        {/* 메인 이미지 (스와이프 가능) */}
        <div
          style={{ background: '#fff', flexShrink: 0 }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <img
            src={IMAGE_URL(data.filename)}
            alt={data.original_name}
            style={{ width: '100%', maxHeight: '55vw', objectFit: 'contain', display: 'block' }}
          />
        </div>

        {/* 썸네일 스트립 */}
        {ThumbnailStrip}

        {/* 구분선 */}
        <div style={{ height: '1px', background: '#e5e7eb', flexShrink: 0 }} />

        {/* 댓글 + 멘트 피드 (자연스럽게 스크롤) */}
        {id && (
          <CommentSection
            imageId={id}
            responses={data.responses}
            onResponseAdded={load}
            mobile
          />
        )}
      </div>
    );
  }

  /* ══════════════ 데스크탑 레이아웃 ══════════════ */
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f3f4f6', overflow: 'hidden' }}>
      {DeleteModal}
      {/* 상단 바 */}
      <div style={{ background: '#4338ca', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: '13px' }}
        >
          ← 목록
        </button>
        {currentIndex >= 0 && (
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
            {currentIndex + 1} / {imageList.length}
          </span>
        )}
        {user && data.user_id === user.id && (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.8)', border: 'none', borderRadius: '8px', color: '#fff', padding: '6px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}
          >
            🗑 삭제
          </button>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* 왼쪽: 이미지 + 썸네일 스트립 */}
        <div
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div style={{ flex: 1, overflow: 'hidden', padding: '20px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', background: '#fff', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
              <img
                src={IMAGE_URL(data.filename)}
                alt={data.original_name}
                style={{ width: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
              />
            </div>
          </div>
          {ThumbnailStrip}
        </div>

        <div style={{ width: '1px', background: '#e5e7eb', flexShrink: 0 }} />

        <div style={{ width: 'clamp(300px, 35vw, 420px)', flexShrink: 0, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
          {id && (
            <CommentSection
              imageId={id}
              responses={data.responses}
              onResponseAdded={load}
            />
          )}
        </div>
      </div>
    </div>
  );
}
