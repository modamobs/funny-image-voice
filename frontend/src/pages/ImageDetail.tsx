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

  const load = async () => {
    if (!id) return;
    const res = await getImage(id);
    setData(res.data);
  };

  useEffect(() => {
    getImages().then(res => setImageList(res.data));
  }, []);

  useEffect(() => { load(); }, [id]);

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

  const navBtn: React.CSSProperties = {
    background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px',
    color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: '16px', whiteSpace: 'nowrap',
  };
  const navBtnDisabled: React.CSSProperties = {
    ...navBtn, opacity: 0.3, cursor: 'default',
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f3f4f6', overflow: 'hidden' }}>

      {/* 상단 바 */}
      <div style={{ background: '#4338ca', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button onClick={() => navigate('/')} style={navBtn}>← 목록</button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => prevId && goTo(prevId)}
          disabled={!prevId}
          style={prevId ? navBtn : navBtnDisabled}
        >
          ‹ 이전
        </button>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', minWidth: '50px', textAlign: 'center' }}>
          {currentIndex >= 0 ? `${currentIndex + 1} / ${imageList.length}` : ''}
        </span>
        <button
          onClick={() => nextId && goTo(nextId)}
          disabled={!nextId}
          style={nextId ? navBtn : navBtnDisabled}
        >
          다음 ›
        </button>
      </div>

      {/* 좌우 분할 영역 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* 왼쪽: 이미지 (스와이프 영역) */}
        <div
          style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', background: '#000', width: '100%' }}>
            <img
              src={IMAGE_URL(data.filename)}
              alt={data.original_name}
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
            />
          </div>
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
