import { useState, useEffect, useRef } from 'react';
import type { Comment } from '../types';
import { getComments, postComment, updateComment, deleteComment, likeComment } from '../api';
import { useAuth } from '../hooks/useAuth';

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
    if (!confirm('댓글을 삭제할까요?')) return;
    await deleteComment(comment.id);
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
              <button onClick={handleDelete} style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff1f2', color: '#ef4444', cursor: 'pointer' }}>삭제</button>
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
              border: likedByMe ? '1.5px solid #f43f5e' : '1.5px solid #e5e7eb',
              background: likedByMe ? '#fff1f2' : '#f9fafb',
              color: likedByMe ? '#f43f5e' : '#9ca3af',
              fontSize: '13px', fontWeight: 600,
              cursor: canLike ? 'pointer' : 'default',
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: '14px' }}>{likedByMe ? '❤️' : '🤍'}</span>
            {likes > 0 && <span>{likes}</span>}
          </button>
        </div>
      )}
    </div>
  );
}

interface Props {
  imageId: string;
}

export default function CommentSection({ imageId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const { user, login } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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
      // 새 댓글 등록 후 목록 맨 아래로 스크롤
      setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      }, 50);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* 헤더 */}
      <div style={{ padding: '16px 20px 12px', flexShrink: 0, borderBottom: '1px solid #f3f4f6' }}>
        <h3 style={{ margin: 0, color: '#111827', fontSize: '16px', fontWeight: 700 }}>
          댓글 <span style={{ color: '#6366f1' }}>{comments.length}</span>
        </h3>
      </div>

      {/* 댓글 목록 (스크롤 영역) */}
      <div ref={listRef} className="hover-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: 0 }}>
        {comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
            첫 댓글을 남겨보세요!
          </div>
        ) : (
          comments.map((c) => (
            <CommentItem key={c.id} comment={c} myId={user?.id ?? null} onChanged={load} />
          ))
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
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <img src={user.picture} alt={user.name} style={{ width: 26, height: 26, borderRadius: '50%', flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: '#4338ca', fontSize: '13px' }}>{user.name}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                placeholder="댓글 추가..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={2}
                style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '13px', resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
              <button
                type="submit"
                disabled={submitting || !text.trim()}
                style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', background: submitting || !text.trim() ? '#d1d5db' : '#6366f1', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: submitting || !text.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                {submitting ? '...' : '등록'}
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
}
