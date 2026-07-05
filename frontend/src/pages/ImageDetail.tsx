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
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* 상단 바 */}
      <div style={{ background: '#4338ca', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: '#fff', padding: '8px 14px', cursor: 'pointer', fontSize: '14px' }}
        >
          ← 목록으로
        </button>
        <h2 style={{ margin: 0, color: '#fff', fontSize: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.original_name}
        </h2>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
        {/* 이미지 */}
        <div style={{ borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.12)', marginBottom: '24px' }}>
          <img
            src={IMAGE_URL(data.filename)}
            alt={data.original_name}
            style={{ width: '100%', maxHeight: '500px', objectFit: 'contain', background: '#000', display: 'block' }}
          />
        </div>

        {/* 액션 버튼 */}
        {!user ? (
          <div style={{ marginBottom: '32px', padding: '16px', background: '#fff', borderRadius: '12px', textAlign: 'center', border: '2px dashed #e5e7eb' }}>
            <p style={{ margin: '0 0 12px', color: '#6b7280' }}>AI 멘트 생성과 녹음은 로그인이 필요합니다</p>
            <button onClick={login} style={{ padding: '10px 24px', borderRadius: '20px', border: 'none', background: '#4338ca', color: '#fff', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 16, height: 16 }} />
              Google 로그인
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '32px', alignItems: 'center' }}>
            <button
              onClick={handleAiResponse}
              disabled={aiLoading}
              style={{
                padding: '12px 24px',
                borderRadius: '50px',
                border: 'none',
                background: aiLoading ? '#9ca3af' : '#f59e0b',
                color: '#fff',
                fontSize: '16px',
                cursor: aiLoading ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {aiLoading ? '⏳ AI 생각 중...' : '🤖 AI 멘트 생성'}
            </button>
            <span style={{ fontSize: '13px', color: '#9ca3af' }}>오늘 {user.ai_usage_today}/5회 사용</span>

            <RecordButton onRecordingComplete={handleRecording} disabled={uploading} />
            {uploading && <span style={{ color: '#6b7280', fontSize: '14px' }}>업로드 중...</span>}
          </div>
        )}

        {/* 응답 목록 */}
        <h3 style={{ margin: '0 0 16px', color: '#111827' }}>
          🎙 멘트 {data.responses.length}개
        </h3>

        {data.responses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', background: '#fff', borderRadius: '12px' }}>
            <p style={{ fontSize: '36px', margin: 0 }}>🎤</p>
            <p>아직 멘트가 없어요! AI에게 맡기거나 직접 녹음해보세요.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {data.responses.map((r) => (
              <ResponseCard key={r.id} response={r} />
            ))}
          </div>
        )}

        {id && <CommentSection imageId={id} />}
      </div>
    </div>
  );
}
