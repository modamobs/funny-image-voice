import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  adminGetStats, adminGetImages, adminDeleteImage,
  adminGetUsers, adminGetComments, adminDeleteComment,
  adminGetResponses, adminDeleteResponse, IMAGE_URL,
  adminGetRounds, adminCreateRound, adminCloseRound, adminDeleteRound,
} from '../api';

type Tab = 'dashboard' | 'rounds' | 'images' | 'users' | 'comments' | 'responses';

interface Stats { images: number; users: number; comments: number; replies: number; responses: number; }
interface AdminImage { id: string; filename: string; original_name: string; created_at: string; response_count: number; comment_count: number; }
interface AdminUser { id: string; name: string; email: string; picture: string; created_at: string; comment_count: number; response_count: number; }
interface AdminComment { id: string; nickname: string; text: string; created_at: string; image_id: string; image_name: string; user_email: string; parent_id: string | null; }
interface AdminRound {
  id: string; image_id: string; image_filename: string; image_name: string;
  opens_at: string; closes_at: string; status: 'scheduled' | 'open' | 'closed';
  winner_response_id: string | null; entry_count: number;
}
interface AdminResponse { id: string; type: 'ai' | 'user'; ai_text?: string; created_at: string; image_id: string; image_name: string; user_name: string; user_email: string; votes: number; }

function ConfirmModal({ message, onConfirm, onCancel, confirmLabel = '삭제' }: { message: string; onConfirm: () => void; onCancel: () => void; confirmLabel?: string }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '28px', width: '300px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827', textAlign: 'center', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>{confirmLabel}</button>
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
  const [rounds, setRounds] = useState<AdminRound[]>([]);
  const [pickedImage, setPickedImage] = useState<string | null>(null);
  const [roundBusy, setRoundBusy] = useState(false);
  const [roundError, setRoundError] = useState('');
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void; confirmLabel?: string } | null>(null);
  const [tabLoaded, setTabLoaded] = useState<Set<Tab>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    adminGetStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (tabLoaded.has(tab)) return;
    setTabLoaded(p => new Set(p).add(tab));
    if (tab === 'rounds') {
      adminGetRounds().then(r => setRounds(r.data)).catch(() => {});
      adminGetImages().then(r => setImages(r.data)).catch(() => {});
    }
    if (tab === 'images') adminGetImages().then(r => setImages(r.data)).catch(() => {});
    if (tab === 'users') adminGetUsers().then(r => setUsers(r.data)).catch(() => {});
    if (tab === 'comments') adminGetComments().then(r => setComments(r.data)).catch(() => {});
    if (tab === 'responses') adminGetResponses().then(r => setResponses(r.data)).catch(() => {});
  }, [tab, tabLoaded]);

  const changeTab = (t: Tab) => { setTab(t); setSelected(new Set()); };

  const reload = (t: Tab) => {
    setTabLoaded(p => { const s = new Set(p); s.delete(t); return s; });
    adminGetStats().then(r => setStats(r.data)).catch(() => {});
  };

  const toggleOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleAll = (ids: string[]) => {
    const allChecked = ids.length > 0 && ids.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      allChecked ? ids.forEach(id => next.delete(id)) : ids.forEach(id => next.add(id));
      return next;
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const label = tab === 'images' ? '이미지' : tab === 'comments' ? '댓글' : '음성반응';
    setConfirm({
      message: `선택한 ${ids.length}개의 ${label}을(를) 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`,
      onConfirm: async () => {
        if (tab === 'images') {
          await Promise.all(ids.map(id => adminDeleteImage(id)));
          setImages(p => p.filter(i => !ids.includes(i.id)));
          reload('images');
        } else if (tab === 'comments') {
          await Promise.all(ids.map(id => adminDeleteComment(id)));
          setComments(p => p.filter(c => !ids.includes(c.id)));
          reload('comments');
        } else if (tab === 'responses') {
          await Promise.all(ids.map(id => adminDeleteResponse(id)));
          setResponses(p => p.filter(r => !ids.includes(r.id)));
          reload('responses');
        }
        setSelected(new Set());
        setConfirm(null);
      },
    });
  };

  const reloadRounds = () => { adminGetRounds().then(r => setRounds(r.data)).catch(() => {}); };

  const handleCreateRound = async (dayOffset: number) => {
    if (!pickedImage) return;
    setRoundBusy(true);
    setRoundError('');
    try {
      await adminCreateRound(pickedImage, dayOffset);
      setPickedImage(null);
      reloadRounds();
    } catch (err: unknown) {
      setRoundError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '라운드 등록에 실패했습니다');
    } finally {
      setRoundBusy(false);
    }
  };

  const handleCloseRound = (r: AdminRound) => setConfirm({
    message: '이 라운드를 지금 마감할까요?\n득표 1위가 우승으로 확정되고 되돌릴 수 없습니다.',
    confirmLabel: '마감',
    onConfirm: async () => { await adminCloseRound(r.id); reloadRounds(); setConfirm(null); },
  });

  const handleDeleteRound = (r: AdminRound) => setConfirm({
    message: '예약된 라운드를 삭제할까요?',
    onConfirm: async () => { await adminDeleteRound(r.id); reloadRounds(); setConfirm(null); },
  });

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
  const cbTh: React.CSSProperties = { ...thStyle, width: '36px', textAlign: 'center' };
  const cbTd: React.CSSProperties = { ...tdStyle, width: '36px', textAlign: 'center' };

  const supportsMultiDelete = tab === 'images' || tab === 'comments' || tab === 'responses';

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', paddingBottom: selected.size > 0 ? '80px' : '0' }}>
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
            <button style={tabStyle('dashboard')} onClick={() => changeTab('dashboard')}>대시보드</button>
            <button style={tabStyle('rounds')} onClick={() => changeTab('rounds')}>라운드</button>
            <button style={tabStyle('images')} onClick={() => changeTab('images')}>이미지 {stats ? `(${stats.images})` : ''}</button>
            <button style={tabStyle('users')} onClick={() => changeTab('users')}>사용자 {stats ? `(${stats.users})` : ''}</button>
            <button style={tabStyle('comments')} onClick={() => changeTab('comments')}>댓글 {stats ? `(${stats.comments + stats.replies})` : ''}</button>
            <button style={tabStyle('responses')} onClick={() => changeTab('responses')}>음성 {stats ? `(${stats.responses})` : ''}</button>
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

            {/* 라운드 */}
            {tab === 'rounds' && (() => {
              const badge = (st: AdminRound['status']) => st === 'open'
                ? { bg: '#d1fae5', fg: '#065f46', label: '진행 중' }
                : st === 'scheduled'
                  ? { bg: '#fef3c7', fg: '#92400e', label: '예약됨' }
                  : { bg: '#f3f4f6', fg: '#6b7280', label: '마감' };
              const hasOpen = rounds.some(r => r.status === 'open');
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#111827' }}>라운드</h3>
                    <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6b7280' }}>
                      한국 시간 매일 09:00 시작 → 21:00 마감. 진행 중인 라운드가 있으면 예약된 라운드는 그 뒤에 열립니다.
                    </p>
                    {rounds.length === 0 ? (
                      <div style={{ padding: '28px', textAlign: 'center', color: '#9ca3af', fontSize: '13.5px', border: '1.5px dashed #e5e7eb', borderRadius: '10px' }}>
                        아직 등록된 라운드가 없습니다. 아래에서 짤을 골라 첫 판을 열어보세요.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {rounds.map(r => {
                          const b = badge(r.status);
                          return (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '10px 12px', background: '#fff' }}>
                              <img src={IMAGE_URL(r.image_filename)} alt="" style={{ width: 64, height: 44, objectFit: 'cover', borderRadius: '6px', background: '#f3f4f6', flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                  <span style={{ background: b.bg, color: b.fg, fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px' }}>{b.label}</span>
                                  <span style={{ fontSize: '13px', color: '#374151', fontWeight: 600 }}>멘트 {r.entry_count}개</span>
                                </div>
                                <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '3px' }}>
                                  {fmtDate(r.opens_at)} → {fmtDate(r.closes_at)}
                                </div>
                              </div>
                              {r.status === 'open' && (
                                <button onClick={() => handleCloseRound(r)} style={{ ...delBtn, background: '#fef3c7', color: '#92400e' }}>지금 마감</button>
                              )}
                              {r.status === 'scheduled' && (
                                <button onClick={() => handleDeleteRound(r)} style={delBtn}>예약 취소</button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: '#111827' }}>새 라운드 열기</h3>
                    <p style={{ margin: '0 0 14px', fontSize: '13px', color: '#6b7280' }}>짤을 하나 고르세요.</p>
                    <div className="hover-scrollbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px', maxHeight: '340px', overflowY: 'auto', padding: '2px' }}>
                      {images.map(img => {
                        const on = pickedImage === img.id;
                        return (
                          <button
                            key={img.id}
                            onClick={() => setPickedImage(on ? null : img.id)}
                            style={{
                              padding: 0, cursor: 'pointer', borderRadius: '8px', overflow: 'hidden',
                              border: on ? '3px solid #4338ca' : '1px solid #e5e7eb',
                              background: '#f3f4f6', display: 'block', lineHeight: 0,
                            }}
                          >
                            <img src={IMAGE_URL(img.filename)} alt={img.original_name} loading="lazy" style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }} />
                          </button>
                        );
                      })}
                    </div>

                    {roundError && <p style={{ margin: '12px 0 0', color: '#ef4444', fontSize: '13px', fontWeight: 600 }}>{roundError}</p>}

                    <div style={{ display: 'flex', gap: '10px', marginTop: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => handleCreateRound(0)}
                        disabled={!pickedImage || roundBusy}
                        style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: !pickedImage || roundBusy ? '#d1d5db' : '#4338ca', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: !pickedImage || roundBusy ? 'not-allowed' : 'pointer' }}
                      >
                        {roundBusy ? '등록 중...' : '오늘 라운드로 열기'}
                      </button>
                      <button
                        onClick={() => handleCreateRound(1)}
                        disabled={!pickedImage || roundBusy}
                        style={{ padding: '10px 18px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#fff', color: '#374151', fontSize: '14px', fontWeight: 700, cursor: !pickedImage || roundBusy ? 'not-allowed' : 'pointer' }}
                      >
                        내일로 예약
                      </button>
                      {!pickedImage && <span style={{ fontSize: '12.5px', color: '#9ca3af' }}>짤을 먼저 선택하세요</span>}
                      {pickedImage && hasOpen && <span style={{ fontSize: '12.5px', color: '#92400e' }}>진행 중인 라운드가 있어 마감 후 열립니다</span>}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 이미지 */}
            {tab === 'images' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={cbTh}>
                      <input type="checkbox"
                        checked={images.length > 0 && images.every(i => selected.has(i.id))}
                        onChange={() => toggleAll(images.map(i => i.id))}
                      />
                    </th>
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
                    <tr key={img.id} style={{ background: selected.has(img.id) ? '#eff6ff' : 'transparent' }}>
                      <td style={cbTd}><input type="checkbox" checked={selected.has(img.id)} onChange={() => toggleOne(img.id)} /></td>
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
                            setSelected(p => { const n = new Set(p); n.delete(img.id); return n; });
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
                    <th style={cbTh}>
                      <input type="checkbox"
                        checked={comments.length > 0 && comments.every(c => selected.has(c.id))}
                        onChange={() => toggleAll(comments.map(c => c.id))}
                      />
                    </th>
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
                    <tr key={c.id} style={{ background: selected.has(c.id) ? '#eff6ff' : 'transparent' }}>
                      <td style={cbTd}><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} /></td>
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
                            setSelected(p => { const n = new Set(p); n.delete(c.id); return n; });
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
                    <th style={cbTh}>
                      <input type="checkbox"
                        checked={responses.length > 0 && responses.every(r => selected.has(r.id))}
                        onChange={() => toggleAll(responses.map(r => r.id))}
                      />
                    </th>
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
                    <tr key={r.id} style={{ background: selected.has(r.id) ? '#eff6ff' : 'transparent' }}>
                      <td style={cbTd}><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
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
                            setSelected(p => { const n = new Set(p); n.delete(r.id); return n; });
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

      {/* 일괄 삭제 바 */}
      {selected.size > 0 && supportsMultiDelete && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', padding: '14px 24px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.35)', zIndex: 200, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{selected.size}개 선택됨</span>
          <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.2)' }} />
          <button onClick={handleBulkDelete} style={{ padding: '7px 18px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            선택 삭제
          </button>
          <button onClick={() => setSelected(new Set())} style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.25)', background: 'transparent', color: 'rgba(255,255,255,0.8)', fontSize: '13px', cursor: 'pointer' }}>
            취소
          </button>
        </div>
      )}

      {confirm && <ConfirmModal message={confirm.message} confirmLabel={confirm.confirmLabel} onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
    </div>
  );
}
