import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getImage, IMAGE_URL } from '../api';
import type { ImageDetail as ImageDetailType } from '../types';
import CommentSection from '../components/CommentSection';

export default function ImageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ImageDetailType | null>(null);

  const load = async () => {
    if (!id) return;
    const res = await getImage(id);
    setData(res.data);
  };

  useEffect(() => { load(); }, [id]);

  if (!data) return <div style={{ textAlign: 'center', padding: '80px', color: '#6b7280' }}>로딩 중...</div>;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f3f4f6', overflow: 'hidden' }}>

      {/* 상단 바 */}
      <div style={{ background: '#4338ca', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: '13px', whiteSpace: 'nowrap' }}
        >
          ← 목록
        </button>
        <h2 style={{ margin: 0, color: '#fff', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} />
      </div>

      {/* 좌우 분할 영역 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* 왼쪽: 이미지 */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', background: '#000' }}>
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
