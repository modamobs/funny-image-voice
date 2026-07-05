import { useState, useEffect } from 'react';
import type { Comment } from '../types';
import { getComments, postComment } from '../api';
import { useAuth } from '../hooks/useAuth';

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
            <div key={c.id} style={{ background: '#fff', borderRadius: '12px', padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, color: '#4338ca', fontSize: '14px' }}>{c.nickname}</span>
                <span style={{ color: '#9ca3af', fontSize: '12px' }}>
                  {new Date(c.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
              <p style={{ margin: 0, color: '#374151', fontSize: '15px', lineHeight: '1.5' }}>{c.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
