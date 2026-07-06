import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  adminGetStats, adminGetImages, adminDeleteImage,
  adminGetUsers, adminGetComments, adminDeleteComment,
  adminGetResponses, adminDeleteResponse, IMAGE_URL,
} from '../api';

type Tab = 'dashboard' | 'images' | 'users' | 'comments' | 'responses';

interface Stats { images: number; users: number; comments: number; replies: number; responses: number; }
interface AdminImage { id: string; filename: string; original_name: string; created_at: string; response_count: number; comment_count: number; }
interface AdminUser { id: string; name: string; email: string; picture: string; created_at: string; comment_count: number; response_count: number; }
interface AdminComment { id: string; nickname: string; text: string; created_at: string; image_id: string; image_name: string; user_email: string; parent_id: string | null; }
interface AdminResponse { id: string; type: 'ai' | 'user'; ai_text?: string; created_at: string; image_id: string; image_name: string; user_name: string; user_email: string; votes: number; }

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '300px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827', textAlign: 'center', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>삭제</button>
        </div>
      </div>
    </div>
  );
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Admin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [images, setImages] = useState<AdminImage[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [responses, setResponses] = useState<AdminResponse[]>([]);
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [tabLoaded, setTabLoaded] = useState<Set<Tab>>(new Set());

  useEffect(() => {
    adminGetStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tabLoaded.has(tab)) return;
    setTabLoaded(p => new Set(p).add(tab));
    if (tab === 'images') adminGetImages().then(r => setImages(r.data)).catch(() => {});
    if (tab === 'users') adminGetUsers().then(r => setUsers(r.data)).catch(() => {});
    if (tab === 'comments') adminGetComments().then(r => setComments(r.data)).catch(() => {});
    if (tab === 'responses') adminGetResponses().then(r => setResponses(r.data)).catch(() => {});
  }, [tab]);

  const reload = (t: Tab) => {
    setTabLoaded(p => { const s = new Set(p); s.delete(t); return s; });
    adminGetStats().then(r => setStats(r.data)).catch(() => {});
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#6b7280' }}>로딩 중...</div>;
  if (!user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
      <p style={{ color: '#6b7280' }}>관리자 페이지는 로그인이 필요합니다</p>
      <button onClick={() => navigate('/')} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', background: '#4338ca', color: '#fff', cursor: 'pointer' }}>홈으로</button>
    </div>
  );
  if (!user.is_admin) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
      <p style={{ fontSize: '18px', color: '#ef4444', fontWeight: 700 }}>접근 권한이 없습니다</p>
      <button onClick={() => navigate('/')} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', background: '#4338ca', color: '#fff', cursor: 'pointer' }}>홈으로</button>
    </div>
  );

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
    fontSize: '14px', fontWeight: 600, borderBottom: tab === t ? '2px solid #4338ca' : '2px solid transparent',
    color: tab === t ? '#4338ca' : '#6b7280',
  });

  const delBtn: React.CSSProperties = {
    padding: '4px 10px', border: 'none', background: '#fee2e2', color: '#ef4444',
    borderRadius: '6px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
  };

  const thStyle: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 700, color: '#6b7280', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', color: '#374151', borderBottom: '1px solid #f3f4f6', verticalAlign: 'middle' };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      {/* 헤더 */}
      <div style={{ background: '#312e81', padding: '16px 24px', color: '#fff', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer', padding: 0 }}>← 홈</button>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>🛠 관리자 패널</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src={user.picture} alt={user.name} style={{ width: 28, height: 28, borderRadius: '50%' }} />
          <span style={{ fontSize: '13px', opacity: 0.8 }}>{user.name}</span>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>

        {/* 통계 카드 */}
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '28px' }}>
            {[
              { label: '이미지', value: stats.images, emoji: '🖼', color: '#6366f1' },
              { label: '사용자', value: stats.users, emoji: '👤', color: '#10b981' },
              { label: '댓글', value: stats.comments + stats.replies, emoji: '💬', color: '#f59e0b' },
              { label: '음성반응', value: stats.responses, emoji: '🎤', color: '#ef4444' },
            ].map(card => (
              <div key={card.label} style={{ background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '24px' }}>{card.emoji}</span>
                <span style={{ fontSize: '28px', fontWeight: 800, color: card.color }}>{card.value.toLocaleString()}</span>
                <span style={{ fontSize: '13px', color: '#6b7280' }}>{card.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* 탭 */}
        <div style={{ background: '#fff', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
            <button style={tabStyle('dashboard')} onClick={() => setTab('dashboard')}>대시보드</button>
            <button style={tabStyle('images')} onClick={() => setTab('images')}>이미지 {stats ? `(${stats.images})` : ''}</button>
            <button style={tabStyle('users')} onClick={() => setTab('users')}>사용자 {stats ? `(${stats.users})` : ''}</button>
            <button style={tabStyle('comments')} onClick={() => setTab('comments')}>댓글 {stats ? `(${stats.comments + stats.replies})` : ''}</button>
            <button style={tabStyle('responses')} onClick={() => setTab('responses')}>음성 {stats ? `(${stats.responses})` : ''}</button>
          </div>

          <div style={{ padding: '24px', overflowX: 'auto' }}>

            {/* 대시보드 */}
            {tab === 'dashboard' && stats && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ margin: 0, color: '#374151', fontSize: '15px' }}>서비스 현황 요약입니다.</p>
                <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#6b7280', fontSize: '14px', lineHeight: 2 }}>
                  <li>총 <strong>{stats.images}개</strong>의 이미지가 업로드되어 있습니다.</li>
                  <li>가입한 사용자는 <strong>{stats.users}명</strong>입니다.</li>
                  <li>텍스트 댓글 <strong>{stats.comments}개</strong>, 답글 <strong>{stats.replies}개</strong></li>
                  <li>음성 반응은 <strong>{stats.responses}개</strong>입니다.</li>
                </ul>
              </div>
            )}

            {/* 이미지 */}
            {tab === 'images' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>썸네일</th>
                    <th style={thStyle}>파일명</th>
                    <th style={thStyle}>업로드일</th>
                    <th style={thStyle}>음성</th>
                    <th style={thStyle}>댓글</th>
                    <th style={thStyle}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {images.map(img => (
                    <tr key={img.id}>
                      <td style={tdStyle}>
                        <img src={IMAGE_URL(img.filename)} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: '8px', cursor: 'pointer' }} onClick={() => navigate(`/image/${img.id}`)} />
                      </td>
                      <td style={tdStyle}><span style={{ color: '#4338ca', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/image/${img.id}`)}>{img.original_name}</span></td>
                      <td style={tdStyle}>{fmtDate(img.created_at)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{img.response_count}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{img.comment_count}</td>
                      <td style={tdStyle}>
                        <button style={delBtn} onClick={() => setConfirm({
                          message: `"${img.original_name}" 이미지와 모든 반응/댓글을 삭제할까요?`,
                          onConfirm: async () => {
                            await adminDeleteImage(img.id);
                            setImages(p => p.filter(i => i.id !== img.id));
                            setConfirm(null);
                            reload('images');
                          },
                        })}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 사용자 */}
            {tab === 'users' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>프로필</th>
                    <th style={thStyle}>이름</th>
                    <th style={thStyle}>이메일</th>
                    <th style={thStyle}>가입일</th>
                    <th style={thStyle}>댓글</th>
                    <th style={thStyle}>음성</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td style={tdStyle}><img src={u.picture} alt={u.name} style={{ width: 32, height: 32, borderRadius: '50%' }} /></td>
                      <td style={tdStyle}><span style={{ fontWeight: 600 }}>{u.name}</span></td>
                      <td style={tdStyle}>{u.email}</td>
                      <td style={tdStyle}>{fmtDate(u.created_at)}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{u.comment_count}</td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{u.response_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 댓글 */}
            {tab === 'comments' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>작성자</th>
                    <th style={thStyle}>내용</th>
                    <th style={thStyle}>이미지</th>
                    <th style={thStyle}>구분</th>
                    <th style={thStyle}>작성일</th>
                    <th style={thStyle}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {comments.map(c => (
                    <tr key={c.id}>
                      <td style={tdStyle}><span style={{ fontWeight: 600 }}>{c.nickname}</span><br /><span style={{ fontSize: '11px', color: '#9ca3af' }}>{c.user_email}</span></td>
                      <td style={{ ...tdStyle, maxWidth: '300px' }}><span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.text}</span></td>
                      <td style={tdStyle}><span style={{ color: '#4338ca', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/image/${c.image_id}`)}>{c.image_name}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: c.parent_id ? '#ede9fe' : '#f0fdf4', color: c.parent_id ? '#7c3aed' : '#16a34a', fontWeight: 700 }}>{c.parent_id ? '답글' : '댓글'}</span></td>
                      <td style={tdStyle}>{fmtDate(c.created_at)}</td>
                      <td style={tdStyle}>
                        <button style={delBtn} onClick={() => setConfirm({
                          message: '이 댓글을 삭제할까요?',
                          onConfirm: async () => {
                            await adminDeleteComment(c.id);
                            setComments(p => p.filter(x => x.id !== c.id));
                            setConfirm(null);
                            reload('comments');
                          },
                        })}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* 음성 */}
            {tab === 'responses' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thStyle}>타입</th>
                    <th style={thStyle}>작성자</th>
                    <th style={thStyle}>AI 멘트</th>
                    <th style={thStyle}>이미지</th>
                    <th style={thStyle}>👍</th>
                    <th style={thStyle}>작성일</th>
                    <th style={thStyle}>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map(r => (
                    <tr key={r.id}>
                      <td style={tdStyle}><span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: r.type === 'ai' ? '#e0e7ff' : '#dcfce7', color: r.type === 'ai' ? '#4338ca' : '#16a34a', fontWeight: 700 }}>{r.type === 'ai' ? 'AI' : '사용자'}</span></td>
                      <td style={tdStyle}><span style={{ fontWeight: 600 }}>{r.user_name ?? '익명'}</span><br /><span style={{ fontSize: '11px', color: '#9ca3af' }}>{r.user_email}</span></td>
                      <td style={{ ...tdStyle, maxWidth: '280px', fontStyle: r.ai_text ? 'italic' : 'normal', color: r.ai_text ? '#374151' : '#9ca3af' }}>{r.ai_text ?? '-'}</td>
                      <td style={tdStyle}><span style={{ color: '#4338ca', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => navigate(`/image/${r.image_id}`)}>{r.image_name}</span></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{r.votes}</td>
                      <td style={tdStyle}>{fmtDate(r.created_at)}</td>
                      <td style={tdStyle}>
                        <button style={delBtn} onClick={() => setConfirm({
                          message: '이 음성반응을 삭제할까요?',
                          onConfirm: async () => {
                            await adminDeleteResponse(r.id);
                            setResponses(p => p.filter(x => x.id !== r.id));
                            setConfirm(null);
                            reload('responses');
                          },
                        })}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>
        </div>
      </div>

      {confirm && <ConfirmModal message={confirm.message} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  );
}
