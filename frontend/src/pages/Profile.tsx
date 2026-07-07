import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { profileGetImages, profileGetComments, profileGetResponses, IMAGE_URL, AUDIO_URL } from '../api';
import { useAuth } from '../hooks/useAuth';

type Tab = 'images' | 'comments' | 'responses';

interface ProfileImage {
  id: string;
  filename: string;
  original_name: string;
  created_at: string;
  response_count: number;
}

interface ProfileComment {
  id: string;
  image_id: string;
  image_filename: string;
  text: string;
  created_at: string;
}

interface ProfileResponse {
  id: string;
  image_id: string;
  image_filename: string;
  type: 'ai' | 'user';
  ai_text?: string;
  audio_filename: string;
  created_at: string;
}

function TimeLabel({ iso }: { iso: string }) {
  return (
    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
      {new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('images');
  const [images, setImages] = useState<ProfileImage[]>([]);
  const [comments, setComments] = useState<ProfileComment[]>([]);
  const [responses, setResponses] = useState<ProfileResponse[]>([]);
  const [fetched, setFetched] = useState<Set<Tab>>(new Set());

  useEffect(() => {
    if (!loading && !user) navigate('/');
  }, [user, loading]);

  useEffect(() => {
    if (!user || fetched.has(tab)) return;
    setFetched(prev => new Set(prev).add(tab));
    if (tab === 'images') profileGetImages().then(r => setImages(r.data));
    if (tab === 'comments') profileGetComments().then(r => setComments(r.data));
    if (tab === 'responses') profileGetResponses().then(r => setResponses(r.data));
  }, [tab, user]);

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: '8px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer',
        fontWeight: 700, fontSize: '14px',
        background: tab === t ? '#4338ca' : 'transparent',
        color: tab === t ? '#fff' : '#6b7280',
      }}
    >
      {label}
    </button>
  );

  if (loading) return <div style={{ textAlign: 'center', padding: '80px', color: '#6b7280' }}>로딩 중...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* 헤더 */}
      <div style={{ background: '#4338ca', padding: '20px 24px', color: '#fff' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => navigate('/')}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: '#fff', padding: '6px 14px', cursor: 'pointer', fontSize: '13px' }}
          >
            ← 홈
          </button>
          <img src={user.picture} alt={user.name} style={{ width: 48, height: 48, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)' }} />
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '18px' }}>{user.name}</p>
            <p style={{ margin: 0, fontSize: '13px', opacity: 0.75 }}>{user.email}</p>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px 16px 0' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#f3f4f6', borderRadius: '24px', padding: '4px', width: 'fit-content' }}>
          {tabBtn('images', `📸 내 이미지`)}
          {tabBtn('comments', `💬 내 댓글`)}
          {tabBtn('responses', `🎙 내 멘트`)}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* 이미지 탭 */}
        {tab === 'images' && (
          images.length === 0
            ? <Empty text="아직 올린 이미지가 없어요" />
            : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                {images.map(img => (
                  <div
                    key={img.id}
                    onClick={() => navigate(`/image/${img.id}`)}
                    style={{ background: '#fff', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', cursor: 'pointer' }}
                  >
                    <img src={IMAGE_URL(img.filename)} alt="" style={{ width: '100%', height: '160px', objectFit: 'cover', display: 'block' }} />
                    <div style={{ padding: '10px 12px' }}>
                      <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>🎙 {img.response_count}개 · <TimeLabel iso={img.created_at} /></p>
                    </div>
                  </div>
                ))}
              </div>
        )}

        {/* 댓글 탭 */}
        {tab === 'comments' && (
          comments.length === 0
            ? <Empty text="아직 남긴 댓글이 없어요" />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {comments.map(c => (
                  <div
                    key={c.id}
                    onClick={() => navigate(`/image/${c.image_id}`)}
                    style={{ background: '#fff', borderRadius: '14px', padding: '14px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', cursor: 'pointer', display: 'flex', gap: '14px', alignItems: 'center' }}
                  >
                    <img src={IMAGE_URL(c.image_filename)} alt="" style={{ width: 52, height: 52, borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: '0 0 4px', fontSize: '14px', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.text}</p>
                      <TimeLabel iso={c.created_at} />
                    </div>
                  </div>
                ))}
              </div>
        )}

        {/* 멘트(음성) 탭 */}
        {tab === 'responses' && (
          responses.length === 0
            ? <Empty text="아직 남긴 멘트가 없어요" />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {responses.map(r => (
                  <div
                    key={r.id}
                    style={{ background: '#fff', borderRadius: '14px', padding: '14px 16px', boxShadow: '0 2px 10px rgba(0,0,0,0.07)', display: 'flex', gap: '14px', alignItems: 'flex-start' }}
                  >
                    <img
                      src={IMAGE_URL(r.image_filename)}
                      alt=""
                      onClick={() => navigate(`/image/${r.image_id}`)}
                      style={{ width: 52, height: 52, borderRadius: '10px', objectFit: 'cover', flexShrink: 0, cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        {r.type === 'ai'
                          ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#6366f1', background: '#ede9fe', borderRadius: '6px', padding: '1px 7px' }}>🤖 AI</span>
                          : <span style={{ fontSize: '11px', fontWeight: 700, color: '#0ea5e9', background: '#e0f2fe', borderRadius: '6px', padding: '1px 7px' }}>🎤 녹음</span>
                        }
                        <TimeLabel iso={r.created_at} />
                      </div>
                      {r.ai_text && <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#374151', fontStyle: 'italic' }}>"{r.ai_text}"</p>}
                      <audio controls src={AUDIO_URL(r.audio_filename)} style={{ width: '100%', height: '32px' }} />
                    </div>
                  </div>
                ))}
              </div>
        )}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
      <p style={{ fontSize: '40px', margin: '0 0 12px' }}>🫙</p>
      <p style={{ margin: 0, fontSize: '15px' }}>{text}</p>
    </div>
  );
}
