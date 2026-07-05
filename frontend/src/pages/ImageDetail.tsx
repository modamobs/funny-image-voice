import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getImage, generateAiResponse, uploadUserResponse, IMAGE_URL } from '../api';
import type { ImageDetail as ImageDetailType } from '../types';
import RecordButton from '../components/RecordButton';
import ResponseCard from '../components/ResponseCard';
import CommentSection from '../components/CommentSection';
import { useAuth } from '../hooks/useAuth';

export default function ImageDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ImageDetailType | null>(null);
  const { user, login } = useAuth();
  const [aiLoading, setAiLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!id) return;
    const res = await getImage(id);
    setData(res.data);
  };

  useEffect(() => { load(); }, [id]);

  const handleAiResponse = async () => {
    if (!id) return;
    setAiLoading(true);
    try {
      await generateAiResponse(id);
      await load();
    } catch (e: any) {
      alert('AI 응답 생성 실패: ' + (e.response?.data?.error ?? e.message));
    } finally {
      setAiLoading(false);
    }
  };

  const handleRecording = async (blob: Blob) => {
    if (!id) return;
    setUploading(true);
    try {
      await uploadUserResponse(id, blob);
      await load();
    } finally {
      setUploading(false);
    }
  };

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
        <h2 style={{ margin: 0, color: '#fff', fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {data.original_name}
        </h2>
      </div>

      {/* 좌우 분할 영역 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* 왼쪽: 이미지 + 액션 + 응답 */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* 이미지 */}
          <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', background: '#000', flexShrink: 0 }}>
            <img
              src={IMAGE_URL(data.filename)}
              alt={data.original_name}
              style={{ width: '100%', maxHeight: '55vh', objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* 액션 버튼 */}
          {!user ? (
            <div style={{ padding: '16px', background: '#fff', borderRadius: '12px', textAlign: 'center', border: '2px dashed #e5e7eb' }}>
              <p style={{ margin: '0 0 10px', color: '#6b7280', fontSize: '14px' }}>AI 멘트 생성과 녹음은 로그인이 필요합니다</p>
              <button onClick={login} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', background: '#4338ca', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 14, height: 14 }} />
                Google 로그인
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', background: '#fff', padding: '14px 16px', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <button
                onClick={handleAiResponse}
                disabled={aiLoading}
                style={{ padding: '10px 20px', borderRadius: '50px', border: 'none', background: aiLoading ? '#9ca3af' : '#f59e0b', color: '#fff', fontSize: '14px', cursor: aiLoading ? 'not-allowed' : 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {aiLoading ? '⏳ AI 생각 중...' : '🤖 AI 멘트'}
              </button>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>오늘 {user.ai_usage_today}/5회</span>
              <RecordButton onRecordingComplete={handleRecording} disabled={uploading} />
              {uploading && <span style={{ color: '#6b7280', fontSize: '13px' }}>업로드 중...</span>}
            </div>
          )}

          {/* 응답 목록 */}
          <div>
            <h3 style={{ margin: '0 0 12px', color: '#111827', fontSize: '15px' }}>
              🎙 멘트 {data.responses.length}개
            </h3>
            {data.responses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', background: '#fff', borderRadius: '12px' }}>
                <p style={{ fontSize: '32px', margin: '0 0 8px' }}>🎤</p>
                <p style={{ margin: 0, fontSize: '14px' }}>아직 멘트가 없어요! AI에게 맡기거나 직접 녹음해보세요.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.responses.map((r) => (
                  <ResponseCard key={r.id} response={r} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 구분선 */}
        <div style={{ width: '1px', background: '#e5e7eb', flexShrink: 0 }} />

        {/* 오른쪽: 댓글 (독립 스크롤) */}
        <div style={{ width: 'clamp(300px, 35vw, 420px)', flexShrink: 0, overflowY: 'auto', background: '#fff', padding: '20px' }}>
          {id && <CommentSection imageId={id} />}
        </div>

      </div>
    </div>
  );
}
