import { useState } from 'react';
import type { Response } from '../types';
import { vote, AUDIO_URL } from '../api';

interface Props {
  response: Response;
}

export default function ResponseCard({ response }: Props) {
  const [votes, setVotes] = useState(response.votes);
  const [voted, setVoted] = useState(false);

  const handleVote = async () => {
    if (voted) return;
    const res = await vote(response.id);
    setVotes(res.data.votes);
    setVoted(true);
  };

  return (
    <div
      style={{
        background: response.type === 'ai' ? '#f0f4ff' : '#f0fdf4',
        border: `2px solid ${response.type === 'ai' ? '#6366f1' : '#22c55e'}`,
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>{response.type === 'ai' ? '🤖' : '👤'}</span>
        <span style={{ fontWeight: 700, color: response.type === 'ai' ? '#4338ca' : '#16a34a' }}>
          {response.type === 'ai' ? 'AI 멘트' : '유저 녹음'}
        </span>
        <span style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '13px' }}>
          {new Date(response.created_at).toLocaleString('ko-KR')}
        </span>
      </div>

      {response.ai_text && (
        <p style={{ margin: 0, fontStyle: 'italic', color: '#374151', fontSize: '15px' }}>
          "{response.ai_text}"
        </p>
      )}

      <audio controls src={AUDIO_URL(response.audio_filename)} style={{ width: '100%' }} />

      <button
        onClick={handleVote}
        style={{
          alignSelf: 'flex-start',
          padding: '6px 16px',
          borderRadius: '20px',
          border: `1.5px solid ${voted ? '#f59e0b' : '#d1d5db'}`,
          background: voted ? '#fef3c7' : '#fff',
          cursor: voted ? 'default' : 'pointer',
          fontWeight: 600,
          color: '#374151',
        }}
      >
        👍 {votes}
      </button>
    </div>
  );
}
