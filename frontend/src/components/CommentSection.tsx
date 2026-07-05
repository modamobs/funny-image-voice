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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: '40px' }}>
      <h3 style={{ margin: '0 0 16px', color: '#111827' }}>
        💬 댓글 {comments.length}개
      </h3>

      {/* 댓글 입력 */}
      {!user ? (
        <div style={{ marginBottom: '24px', padding: '16px', background: '#fff', borderRadius: '12px', textAlign: 'center', border: '2px dashed #e5e7eb' }}>
          <p style={{ margin: '0 0 10px', color: '#6b7280', fontSize: '14px' }}>댓글은 로그인 후 작성할 수 있습니다</p>
          <button onClick={login} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', background: '#4338ca', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <img src="https://www.google.com/favicon.ico" alt="" style={{ width: 14, height: 14 }} />
            Google 로그인
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ marginBottom: '24px', background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
          {/* 작성자 정보 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <img src={user.picture} alt={user.name} style={{ width: 28, height: 28, borderRadius: '50%' }} />
            <span style={{ fontWeight: 700, color: '#4338ca', fontSize: '14px' }}>{user.name}</span>
            <span style={{ fontSize: '12px', color: '#9ca3af' }}>으로 댓글 작성</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <textarea
              placeholder="댓글을 입력하세요..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              style={{ padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', resize: 'vertical', outline: 'none', fontFamily: 'inherit' }}
            />
            <button
              type="submit"
              disabled={submitting || !text.trim()}
              style={{
                alignSelf: 'flex-end',
                padding: '10px 24px',
                borderRadius: '20px',
                border: 'none',
                background: submitting || !text.trim() ? '#d1d5db' : '#6366f1',
                color: '#fff',
                fontWeight: 700,
                fontSize: '14px',
                cursor: submitting || !text.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? '올리는 중...' : '등록'}
            </button>
          </div>
        </form>
      )}

      {/* 댓글 목록 */}
      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', background: '#fff', borderRadius: '12px' }}>
          첫 댓글을 남겨보세요!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} myId={user?.id ?? null} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
