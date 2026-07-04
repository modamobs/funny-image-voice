import { useState, useEffect } from 'react';
import type { Comment } from '../types';
import { getComments, postComment } from '../api';

interface Props {
  imageId: string;
}

export default function CommentSection({ imageId }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [nickname, setNickname] = useState('');
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
      await postComment(imageId, nickname, text);
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
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
        <input
          type="text"
          placeholder="닉네임 (선택, 기본: 익명)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          style={{ padding: '10px 14px', borderRadius: '8px', border: '1.5px solid #e5e7eb', fontSize: '14px', outline: 'none' }}
        />
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
      </form>

      {/* 댓글 목록 */}
      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#9ca3af', background: '#fff', borderRadius: '12px' }}>
          첫 댓글을 남겨보세요!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {comments.map((c) => (
            <div key={c.id} style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: '#4338ca', fontSize: '14px' }}>
                  {c.nickname}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                  {new Date(c.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
              <p style={{ margin: 0, color: '#374151', fontSize: '15px', lineHeight: '1.5' }}>
                {c.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
