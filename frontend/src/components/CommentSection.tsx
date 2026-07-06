import { useState, useEffect, useRef } from 'react';
import type { Comment, Response } from '../types';
import { getComments, postComment, updateComment, deleteComment, likeComment, uploadUserResponse, vote, deleteResponse, AUDIO_URL } from '../api';
import { useAuth } from '../hooks/useAuth';

// 공통 확인 모달
function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      onClick={onCancel}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: '16px', padding: '28px 28px 20px', width: '300px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '20px' }}
      >
        <p style={{ margin: 0, fontSize: '15px', color: '#111827', textAlign: 'center', lineHeight: 1.6 }}>{message}</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#f9fafb', color: '#374151', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
}

interface CommentItemProps {
  comment: Comment;
  myId: string | null;
  onChanged: () => void;
}

function CommentItem({ comment, myId, onChanged }: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.text);
  const [saving, setSaving] = useState(false);
  const [likes, setLikes] = useState(comment.likes ?? 0);
  const [likedByMe, setLikedByMe] = useState(comment.liked_by_me ?? false);
  const [liking, setLiking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isOwner = myId !== null && comment.user_id === myId;
  const canLike = myId !== null && !isOwner;

  const handleEdit = () => {
    setEditText(comment.text);
    setEditing(true);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSave = async () => {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await updateComment(comment.id, editText.trim());
      setEditing(false);
      onChanged();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteComment(comment.id);
    setConfirmDelete(false);
    onChanged();
  };

  const handleLike = async () => {
    if (!canLike || liking) return;
    setLiking(true);
    // 낙관적 업데이트
    setLikedByMe((prev) => !prev);
    setLikes((prev) => likedByMe ? prev - 1 : prev + 1);
    try {
      const res = await likeComment(comment.id);
      setLikes(res.data.likes);
      setLikedByMe(res.data.liked);
    } catch {
      // 실패 시 롤백
      setLikedByMe((prev) => !prev);
      setLikes((prev) => likedByMe ? prev + 1 : prev - 1);
    } finally {
      setLiking(false);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: '#4338ca' }}>{comment.nickname}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            {new Date(comment.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOwner && !editing && (
            <>
              <button onClick={handleEdit} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', cursor: 'pointer' }}>수정</button>
              <button onClick={() => setConfirmDelete(true)} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff1f2', color: '#ef4444', cursor: 'pointer' }}>삭제</button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={3}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #6366f1', fontSize: '14px', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={{ padding: '6px 14px', borderRadius: '16px', border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>취소</button>
            <button onClick={handleSave} disabled={saving || !editText.trim()} style={{ padding: '6px 14px', borderRadius: '16px', border: 'none', background: saving || !editText.trim() ? '#d1d5db' : '#6366f1', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: saving || !editText.trim() ? 'not-allowed' : 'pointer' }}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <p style={{ margin: 0, fontSize: '14px', color: '#1f2937', lineHeight: 1.6, whiteSpace: 'pre-wrap', flex: 1 }}>{comment.text}</p>
          <button
            onClick={handleLike}
            disabled={!canLike}
            title={myId === null ? '로그인 후 좋아요 가능' : isOwner ? '내 댓글에는 좋아요 불가' : ''}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              marginLeft: '12px', flexShrink: 0,
              padding: '4px 10px', borderRadius: '20px',
              border: likedByMe ? '1.5px solid #f59e0b' : '1.5px solid #e5e7eb',
              background: likedByMe ? '#fef3c7' : '#f9fafb',
              color: likedByMe ? '#b45309' : '#9ca3af',
              fontSize: '13px', fontWeight: 600,
              cursor: canLike ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            👍 {likes > 0 && likes}
          </button>
        </div>
      )}
      {confirmDelete && (
        <ConfirmModal
          message="댓글을 삭제할까요?"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

// 음성 응답 카드 — 댓글과 동일한 레이아웃
function VoiceItem({ response, myId, onDeleted }: { response: Response; myId: string | null; onDeleted: () => void }) {
  const [votes, setVotes] = useState(response.votes);
  const [voted, setVoted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isAi = response.type === 'ai';
  const displayName = isAi ? '🤖 AI' : (response.nickname ?? '익명');
  const isOwner = myId !== null && response.user_id === myId;

  const handleVote = async () => {
    if (voted) return;
    const res = await vote(response.id);
    setVotes(res.data.votes);
    setVoted(true);
  };

  const handleDelete = async () => {
    await deleteResponse(response.id);
    setConfirmDelete(false);
    onDeleted();
  };

  return (
    <div style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: `3px solid ${isAi ? '#6366f1' : '#22c55e'}` }}>
      {/* 헤더: 이름 + 시간 + 삭제 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ fontWeight: 700, fontSize: '13px', color: isAi ? '#4338ca' : '#16a34a' }}>{displayName}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
            {new Date(response.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOwner && (
            <button onClick={() => setConfirmDelete(true)} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff1f2', color: '#ef4444', cursor: 'pointer' }}>삭제</button>
          )}
        </div>
      </div>
      {/* AI 멘트 텍스트 */}
      {response.ai_text && (
        <p style={{ margin: '0 0 8px', fontStyle: 'italic', color: '#374151', fontSize: '13px', lineHeight: 1.5 }}>"{response.ai_text}"</p>
      )}
      {/* 오디오 + 투표 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <audio controls src={AUDIO_URL(response.audio_filename)} style={{ flex: 1, height: '32px', minWidth: 0 }} />
        <button
          onClick={handleVote}
          disabled={voted}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '20px', border: `1.5px solid ${voted ? '#f59e0b' : '#e5e7eb'}`, background: voted ? '#fef3c7' : '#f9fafb', color: voted ? '#b45309' : '#9ca3af', fontSize: '13px', fontWeight: 600, cursor: voted ? 'default' : 'pointer', flexShrink: 0, transition: 'all 0.15s' }}
        >
          👍 {votes > 0 && votes}
        </button>
      </div>
      {confirmDelete && (
        <ConfirmModal
          message="음성을 삭제할까요?"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
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

  // 녹음 상태
  const [inputMode, setInputMode] = useState<'text' | 'recording'>('text');
  const [recordingSec, setRecordingSec] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    const res = await getComments(imageId);
    setComments(res.data);
  };

  useEffect(() => { load(); }, [imageId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await postComment(imageId, '', text);
      setText('');
      await load();
      setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      }, 50);
    } finally {
      setSubmitting(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setUploading(true);
        try {
          await uploadUserResponse(imageId, blob);
          onResponseAdded?.();
        } finally {
          setUploading(false);
          setInputMode('text');
          setRecordingSec(0);
        }
      };
      mr.start();
      setInputMode('recording');
      setRecordingSec(0);
      timerRef.current = setInterval(() => setRecordingSec((s) => s + 1), 1000);
    } catch {
      alert('마이크 권한이 필요합니다.');
    }
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    if (mediaRecorderRef.current?.state !== 'inactive') {
      // onstop이 호출되지 않도록 핸들러 제거 후 중단
      mediaRecorderRef.current!.onstop = null;
      mediaRecorderRef.current?.stop();
    }
    setInputMode('text');
    setRecordingSec(0);
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

      {/* 통합 피드 (음성 응답 + 텍스트 댓글, 시간순) */}
      <div ref={listRef} className="hover-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
        {responses.length === 0 && comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            첫 번째 반응을 남겨보세요!
          </div>
        ) : (
          [
            ...responses.map((r) => ({ kind: 'response' as const, ts: new Date(r.created_at).getTime(), data: r })),
            ...comments.map((c) => ({ kind: 'comment' as const, ts: new Date(c.created_at).getTime(), data: c })),
          ]
            .sort((a, b) => a.ts - b.ts)
            .map((item) =>
              item.kind === 'response'
                ? <VoiceItem key={`r-${item.data.id}`} response={item.data} myId={user?.id ?? null} onDeleted={() => onResponseAdded?.()} />
                : <CommentItem key={`c-${item.data.id}`} comment={item.data} myId={user?.id ?? null} onChanged={load} />
            )
        )}
      </div>

      {/* 입력창 (하단 고정) */}
      <div style={{ flexShrink: 0, borderTop: '1px solid #e5e7eb', padding: '12px 16px', background: '#fff' }}>
        {!user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ flex: 1, fontSize: '13px', color: '#9ca3af' }}>댓글은 로그인 후 작성할 수 있습니다</span>
            <button onClick={login} style={{ padding: '7px 14px', borderRadius: '20px', border: 'none', background: '#4338ca', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
              <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 12, height: 12 }} />
              로그인
            </button>
          </div>
        ) : (
          <>
            {/* 작성자 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <img src={user.picture} alt={user.name} style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: '#4338ca', fontSize: '13px' }}>{user.name}</span>
            </div>

            {inputMode === 'recording' ? (
              /* 녹음 모드 */
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #fca5a5', background: '#fff7f7' }}>
                <span className="rec-dot" />
                <span style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: '#ef4444' }}>
                  {uploading ? '업로드 중...' : `녹음 중  ${fmt(recordingSec)}`}
                </span>
                {!uploading && (
                  <>
                    <button onClick={stopRecording} title="중지 및 업로드" style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', background: '#ef4444', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      ■ 중지
                    </button>
                    <button onClick={cancelRecording} title="취소" style={{ padding: '6px 10px', borderRadius: '16px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: '12px', cursor: 'pointer' }}>
                      ✕
                    </button>
                  </>
                )}
              </div>
            ) : (
              /* 텍스트 모드 */
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                  <textarea
                    placeholder="댓글 추가..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={startRecording}
                      title="음성으로 멘트 남기기"
                      style={{ width: '36px', height: '36px', borderRadius: '50%', border: '1.5px solid #e5e7eb', background: '#f9fafb', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      🎤
                    </button>
                    <button
                      type="submit"
                      disabled={submitting || !text.trim()}
                      style={{ padding: '6px 12px', borderRadius: '16px', border: 'none', background: submitting || !text.trim() ? '#d1d5db' : '#6366f1', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: submitting || !text.trim() ? 'not-allowed' : 'pointer' }}
                    >
                      {submitting ? '...' : '등록'}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </>
        )}
      </div>

    </div>
  );
}
