import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getImage, getImages, IMAGE_URL } from '../api';
import type { ImageDetail as ImageDetailType, ImageItem } from '../types';
import CommentSection from '../components/CommentSection';

export default function ImageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ImageDetailType | null>(null);
  const [imageList, setImageList] = useState<ImageItem[]>([]);
  const touchStartX = useRef<number | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const activeThumbRef = useRef<HTMLButtonElement | null>(null);

  const load = async () => {
    if (!id) return;
    const res = await getImage(id);
    setData(res.data);
  };

  useEffect(() => {
    getImages().then(res => setImageList(res.data));
  }, []);

  useEffect(() => { load(); }, [id]);

  // 현재 썸네일이 스트립 가운데 오도록 스크롤
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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f3f4f6', overflow: 'hidden' }}>

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
      </div>

      {/* 좌우 분할 영역 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* 왼쪽: 이미지 + 썸네일 스트립 */}
        <div
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* 메인 이미지 */}
          <div style={{ flex: 1, overflow: 'hidden', padding: '20px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', background: '#000', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
              <img
                src={IMAGE_URL(data.filename)}
                alt={data.original_name}
                style={{ width: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
              />
            </div>
          </div>

          {/* 썸네일 스트립 */}
          {imageList.length > 1 && (
            <div
              ref={stripRef}
              style={{
                display: 'flex', gap: '8px', padding: '6px 20px 16px',
                overflowX: 'auto', flexShrink: 0,
                scrollbarWidth: 'none',
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
                      flexShrink: 0, width: 64, height: 64, padding: 0, border: 'none',
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
          )}
        </div>

        {/* 구분선 */}
        <div style={{ width: '1px', background: '#e5e7eb', flexShrink: 0 }} />

        {/* 오른쪽: 음성 응답 + 텍스트 댓글 통합 피드 */}
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
