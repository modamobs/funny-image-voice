import { useState, useEffect, useRef } from 'react';
import type { Comment, Response } from '../types';
import { getComments, postComment, updateComment, deleteComment, likeComment, uploadUserResponse, vote, deleteResponse, generateAiResponse, AUDIO_URL } from '../api';
import { useAuth } from '../hooks/useAuth';

// 닉네임으로 아바타 배경색 결정
const AVATAR_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#0ea5e9', '#f97316'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: avatarColor(name), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700, flexShrink: 0 }}>
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

function TimeLabel({ iso }: { iso: string }) {
  return (
    <span style={{ fontSize: '12px', color: '#9ca3af' }}>
      {new Date(iso).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
    </span>
  );
}

// ⋮ 드롭다운 메뉴
function ThreeDotMenu({ items }: { items: { label: string; danger?: boolean; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', marginLeft: 'auto' }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '18px', cursor: 'pointer', padding: '0 4px', lineHeight: 1, borderRadius: '4px' }}
      >
        ⋮
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: '#fff', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: '90px', zIndex: 100, overflow: 'hidden' }}>
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => { item.onClick(); setOpen(false); }}
              style={{ display: 'block', width: '100%', padding: '10px 16px', background: 'none', border: 'none', textAlign: 'left', fontSize: '13px', fontWeight: 600, color: item.danger ? '#ef4444' : '#374151', cursor: 'pointer' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// 공통 확인 모달
function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '16px', padding: '28px 28px 20px', width: '300px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <p style={{ margin: 0, fontSize: '15px', color: '#111827', textAlign: 'center', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>삭제</button>
        </div>
      </div>
    </div>
  );
}

// 액션 버튼 공통 스타일
const actionBtn = (active = false): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '4px',
  padding: '4px 8px', borderRadius: '20px', border: 'none',
  background: 'transparent', cursor: 'pointer',
  fontSize: '13px', fontWeight: 600,
  color: active ? '#b45309' : '#9ca3af',
  transition: 'color 0.15s',
});

interface CommentItemProps {
  comment: Comment;
  myId: string | null;
  onChanged: () => void;
  replies?: Comment[];
  onReply?: (parentId: string, text: string) => Promise<void>;
  isReply?: boolean;
}

function CommentItem({ comment, myId, onChanged, replies = [], onReply, isReply = false }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [saving, setSaving] = useState(false);
  const [likes, setLikes] = useState(comment.likes ?? 0);
  const [likedByMe, setLikedByMe] = useState(comment.liked_by_me ?? false);
  const [liking, setLiking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isOwner = myId !== null && comment.user_id === myId;
  const canLike = myId !== null && !isOwner;

  const handleEdit = () => { setEditText(comment.text); setEditing(true); setTimeout(() => textareaRef.current?.focus(), 0); };

  const handleSave = async () => {
    if (!editText.trim()) return;
    setSaving(true);
    try { await updateComment(comment.id, editText.trim()); setEditing(false); onChanged(); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => { await deleteComment(comment.id); setConfirmDelete(false); onChanged(); };

  const handleLike = async () => {
    if (!canLike || liking) return;
    setLiking(true);
    setLikedByMe(p => !p);
    setLikes(p => likedByMe ? p - 1 : p + 1);
    try {
      const res = await likeComment(comment.id);
      setLikes(res.data.likes); setLikedByMe(res.data.liked);
    } catch {
      setLikedByMe(p => !p); setLikes(p => likedByMe ? p + 1 : p - 1);
    } finally { setLiking(false); }
  };

  const handleReplyToggle = () => {
    if (!myId) return;
    setShowReplyForm(p => !p);
    if (!showReplyForm) setTimeout(() => replyTextareaRef.current?.focus(), 0);
  };

  const handleReplySubmit = async () => {
    if (!replyText.trim() || !onReply) return;
    setSubmittingReply(true);
    try {
      await onReply(comment.id, replyText.trim());
      setReplyText('');
      setShowReplyForm(false);
      setShowReplies(true);
    } finally { setSubmittingReply(false); }
  };

  const avatarSize = isReply ? 28 : 36;

  return (
    <div style={{ display: 'flex', gap: '10px', padding: isReply ? '8px 0' : '12px 0', borderBottom: isReply ? 'none' : '1px solid #f3f4f6' }}>
      <Avatar name={comment.nickname || '?'} size={avatarSize} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <span style={{ fontWeight: 700, fontSize: isReply ? '12px' : '13px', color: '#111827' }}>{comment.nickname}</span>
          <TimeLabel iso={comment.created_at} />
          {isOwner && !editing && (
            <ThreeDotMenu items={[
              { label: '수정', onClick: handleEdit },
              { label: '삭제', danger: true, onClick: () => setConfirmDelete(true) },
            ]} />
          )}
        </div>

        {/* 본문 or 편집 */}
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea ref={textareaRef} value={editText} onChange={e => setEditText(e.target.value)} rows={3}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #6366f1', fontSize: '14px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
              <button onClick={() => setEditing(false)} style={{ padding: '6px 14px', borderRadius: '16px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>취소</button>
              <button onClick={handleSave} disabled={saving || !editText.trim()} style={{ padding: '6px 14px', borderRadius: '16px', border: 'none', background: saving || !editText.trim() ? '#d1d5db' : '#6366f1', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: saving || !editText.trim() ? 'not-allowed' : 'pointer' }}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p style={{ margin: '0 0 6px', fontSize: isReply ? '13px' : '14px', color: '#1f2937', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{comment.text}</p>
            {/* 액션 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <button onClick={handleLike} disabled={!canLike} title={myId === null ? '로그인 후 좋아요 가능' : isOwner ? '내 댓글에는 좋아요 불가' : ''}
                style={{ ...actionBtn(likedByMe), cursor: canLike ? 'pointer' : 'default' }}>
                👍 {likes > 0 ? likes : ''}
              </button>
              {!isReply && (
                <button onClick={handleReplyToggle} style={{ ...actionBtn(showReplyForm), cursor: myId ? 'pointer' : 'default' }}>답글</button>
              )}
            </div>

            {/* 답글 입력 폼 */}
            {!isReply && showReplyForm && (
              <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <textarea
                  ref={replyTextareaRef}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={2}
                  placeholder="답글 추가..."
                  onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleReplySubmit(); }}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, width: '100%', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button onClick={() => { setShowReplyForm(false); setReplyText(''); }}
                    style={{ padding: '6px 12px', borderRadius: '16px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '12px', cursor: 'pointer' }}>
                    취소
                  </button>
                  <button onClick={handleReplySubmit} disabled={!replyText.trim() || submittingReply}
                    style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', background: !replyText.trim() || submittingReply ? '#d1d5db' : '#6366f1', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: !replyText.trim() || submittingReply ? 'not-allowed' : 'pointer' }}>
                    {submittingReply ? '...' : '답글'}
                  </button>
                </div>
              </div>
            )}

            {/* 답글 목록 토글 */}
            {!isReply && replies.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                <button onClick={() => setShowReplies(p => !p)}
                  style={{ background: 'none', border: 'none', color: '#6366f1', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {showReplies ? `▲ 답글 ${replies.length}개 숨기기` : `▼ 답글 ${replies.length}개`}
                </button>
                {showReplies && (
                  <div style={{ marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #e5e7eb' }}>
                    {replies.map(reply => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        myId={myId}
                        onChanged={onChanged}
                        isReply
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {confirmDelete && <ConfirmModal message="댓글을 삭제할까요?" onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />}
    </div>
  );
}

// 음성 응답 아이템
function VoiceItem({ response, myId, onDeleted }: { response: Response; myId: string | null; onDeleted: () => void }) {
  const [votes, setVotes] = useState(response.votes);
  const [voted, setVoted] = useState(response.voted_by_me ?? false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isAi = response.type === 'ai';
  const displayName = isAi ? 'AI' : (response.nickname ?? '익명');
  const isOwner = myId !== null && response.user_id === myId;

  const handleVote = async () => {
    if (voted) return;
    const res = await vote(response.id);
    setVotes(res.data.votes); setVoted(true);
  };

  const handleDelete = async () => { await deleteResponse(response.id); setConfirmDelete(false); onDeleted(); };

  return (
    <div style={{ display: 'flex', gap: '10px', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
      {/* 아바타 */}
      {isAi ? (
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🤖</div>
      ) : (
        <Avatar name={displayName} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <span style={{ fontWeight: 700, fontSize: '13px', color: isAi ? '#4338ca' : '#111827' }}>{displayName}</span>
          <TimeLabel iso={response.created_at} />
          {isOwner && (
            <ThreeDotMenu items={[
              { label: '삭제', danger: true, onClick: () => setConfirmDelete(true) },
            ]} />
          )}
        </div>
        {/* AI 멘트 텍스트 */}
        {response.ai_text && (
          <p style={{ margin: '0 0 8px', fontStyle: 'italic', color: '#374151', fontSize: '13px', lineHeight: 1.5 }}>"{response.ai_text}"</p>
        )}
        {/* 오디오 */}
        <audio controls src={AUDIO_URL(response.audio_filename)} style={{ width: '100%', height: '32px', marginBottom: '6px' }} />
        {/* 액션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button onClick={handleVote} disabled={voted} style={{ ...actionBtn(voted), cursor: voted ? 'default' : 'pointer' }}>
            👍 {votes > 0 ? votes : ''}
          </button>
        </div>
      </div>
      {confirmDelete && <ConfirmModal message="음성을 삭제할까요?" onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />}
    </div>
  );
}

interface Props {
  imageId: string;
  responses: Response[];
  onResponseAdded?: () => void;
}

export default function CommentSection({ imageId, responses, onResponseAdded }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const { user, login } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const [inputMode, setInputMode] = useState<'text' | 'recording'>('text');
  const [recordingSec, setRecordingSec] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => { const res = await getComments(imageId); setComments(res.data); };
  useEffect(() => { load(); }, [imageId]);

  const topLevelComments = comments.filter(c => !c.parent_id);
  const repliesMap = new Map<string, Comment[]>();
  comments.filter(c => c.parent_id != null).forEach(c => {
    const arr = repliesMap.get(c.parent_id!) ?? [];
    arr.push(c);
    repliesMap.set(c.parent_id!, arr);
  });

  const handleReply = async (parentId: string, replyText: string) => {
    await postComment(imageId, '', replyText, parentId);
    await load();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await postComment(imageId, '', text);
      setText('');
      await load();
      setTimeout(() => { if (listRef.current) listRef.current.scrollTop = 0; }, 50);
    } finally { setSubmitting(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setUploading(true);
        try { await uploadUserResponse(imageId, blob); onResponseAdded?.(); }
        finally { setUploading(false); setInputMode('text'); setRecordingSec(0); }
      };
      mr.start();
      setInputMode('recording');
      setRecordingSec(0);
      timerRef.current = setInterval(() => setRecordingSec(s => s + 1), 1000);
    } catch { alert('마이크 권한이 필요합니다.'); }
  };

  const handleAiResponse = async () => {
    setAiLoading(true);
    try {
      await generateAiResponse(imageId);
      onResponseAdded?.();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'AI 멘트 생성 실패';
      alert(msg);
    } finally {
      setAiLoading(false);
    }
  };

  const stopRecording = () => { if (timerRef.current) clearInterval(timerRef.current); mediaRecorderRef.current?.stop(); };
  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stream?.getTracks().forEach(t => t.stop());
    if (mediaRecorderRef.current?.state !== 'inactive') { mediaRecorderRef.current!.onstop = null; mediaRecorderRef.current?.stop(); }
    setInputMode('text'); setRecordingSec(0);
  };
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* 헤더 */}
      <div style={{ padding: '16px 20px 12px', flexShrink: 0, borderBottom: '1px solid #f3f4f6' }}>
        <h3 style={{ margin: 0, color: '#111827', fontSize: '16px', fontWeight: 700 }}>
          반응 <span style={{ color: '#6366f1' }}>{responses.length + comments.length}</span>
        </h3>
      </div>

      {/* 통합 피드 */}
      <div ref={listRef} className="hover-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '0 16px', minHeight: 0 }}>
        {responses.length === 0 && comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>첫 번째 반응을 남겨보세요!</div>
        ) : (() => {
          const all = [
            ...responses.map(r => ({ kind: 'response' as const, ts: new Date(r.created_at).getTime(), score: r.votes, data: r })),
            ...topLevelComments.map(c => ({ kind: 'comment' as const, ts: new Date(c.created_at).getTime(), score: c.likes ?? 0, data: c })),
          ];
          const top = all.filter(i => i.score > 0).reduce<typeof all[0] | null>((b, c) => b === null || c.score > b.score ? c : b, null);
          const rest = all.filter(i => i !== top).sort((a, b) => b.ts - a.ts);

          const renderItem = (item: typeof all[0]) =>
            item.kind === 'response'
              ? <VoiceItem key={`r-${item.data.id}`} response={item.data} myId={user?.id ?? null} onDeleted={() => onResponseAdded?.()} />
              : <CommentItem key={`c-${item.data.id}`} comment={item.data} myId={user?.id ?? null} onChanged={load} replies={repliesMap.get(item.data.id) ?? []} onReply={handleReply} />;

          return (
            <>
              {top && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 0 4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#b45309' }}>🏆 인기 반응</span>
                  </div>
                  <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '10px', background: '#fffbeb', borderRadius: '0 8px 8px 0' }}>
                    {renderItem(top)}
                  </div>
                  {rest.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0 0' }}>
                      <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>최신순</span>
                      <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                    </div>
                  )}
                </>
              )}
              {rest.map(renderItem)}
            </>
          );
        })()}
      </div>

      {/* 입력창 (하단 고정) */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #e5e7eb', padding: '12px 16px', background: '#fff' }}>
        {!user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ flex: 1, fontSize: '13px', color: '#9ca3af' }}>댓글은 로그인 후 작성할 수 있습니다</span>
            <button onClick={login} style={{ padding: '7px 14px', borderRadius: '20px', border: 'none', background: '#4338ca', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
              <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 12, height: 12 }} />로그인
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <img src={user.picture} alt={user.name} style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: '#4338ca', fontSize: '13px' }}>{user.name}</span>
            </div>
            {inputMode === 'recording' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #fca5a5', background: '#fff7f7' }}>
                <span className="rec-dot" />
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>{uploading ? '업로드 중...' : `녹음 중  ${fmt(recordingSec)}`}</span>
                {!uploading && (
                  <>
                    <button onClick={stopRecording} style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>■ 중지</button>
                    <button onClick={cancelRecording} style={{ padding: '6px 10px', borderRadius: '16px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: '12px', cursor: 'pointer' }}>✕</button>
                  </>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <textarea placeholder="댓글 추가..." value={text} onChange={e => setText(e.target.value)} rows={2}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                    <button type="button" onClick={startRecording} title="음성으로 멘트 남기기"
                      style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #e5e7eb', background: '#f9fafb', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎤</button>
                    <button type="submit" disabled={submitting || !text.trim()}
                      style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', background: submitting || !text.trim() ? '#d1d5db' : '#6366f1', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: submitting || !text.trim() ? 'not-allowed' : 'pointer' }}>
                      {submitting ? '...' : '등록'}
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button type="button" onClick={handleAiResponse} disabled={aiLoading}
                    style={{ padding: '6px 14px', borderRadius: '16px', border: 'none', background: aiLoading ? '#d1d5db' : '#f59e0b', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: aiLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {aiLoading ? '⏳ AI 생각 중...' : '🤖 AI 멘트'}
                  </button>
                  <span style={{ fontSize: '11px', color: '#9ca3af' }}>오늘 {user.ai_usage_today}/5회</span>
                </div>
              </form>
            )}
          </>
        )}
      </div>

    </div>
  );
}
