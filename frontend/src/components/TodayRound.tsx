import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTodayRound, AUDIO_URL, IMAGE_URL } from '../api';
import type { DailyRound, RoundEntry } from '../types';

const MEDALS = ['🥇', '🥈', '🥉'];

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function TodayRound({ isMobile }: { isMobile: boolean }) {
  const [round, setRound] = useState<DailyRound | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const closedRef = useRef(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const res = await getTodayRound();
      setRound(res.data);
      closedRef.current = false;
    } catch {
      setRound(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // 남은 시간 표시용 1초 타이머. 열린 라운드일 때만 돈다.
  useEffect(() => {
    if (!round?.is_open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [round?.is_open]);

  // 마감 시각이 지나면 한 번만 다시 불러온다 (서버가 우승자를 확정한 뒤 상태가 바뀐다)
  useEffect(() => {
    if (!round?.is_open || closedRef.current) return;
    if (new Date(round.closes_at).getTime() - now > 0) return;
    closedRef.current = true;
    const id = setTimeout(load, 1500);
    return () => clearTimeout(id);
  }, [now, round?.is_open, round?.closes_at]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const togglePlay = (entry: RoundEntry) => {
    const el = audioRef.current;
    if (!el) return;
    if (playingId === entry.id) {
      el.pause();
      setPlayingId(null);
      return;
    }
    el.src = AUDIO_URL(entry.audio_filename);
    el.play().then(() => setPlayingId(entry.id)).catch(() => setPlayingId(null));
  };

  if (loading) return null;

  const pad = isMobile ? '16px' : '24px';
  const wrapStyle: React.CSSProperties = {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: isMobile ? '16px 12px 0' : '28px 24px 0',
  };

  // 아직 라운드가 등록되지 않은 상태
  if (!round) {
    return (
      <div style={wrapStyle}>
        <div style={{
          background: '#fff', border: '1.5px dashed #d1d5db', borderRadius: '16px',
          padding: '18px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '14px',
        }}>
          🗓 오늘의 짤이 아직 준비되지 않았어요
        </div>
      </div>
    );
  }

  const isOpen = round.is_open;
  const remaining = new Date(round.closes_at).getTime() - now;
  const urgent = isOpen && remaining < 60 * 60 * 1000;
  const top = round.entries.slice(0, 3);
  const joined = Boolean(round.my_entry_id);

  const goToRound = () => navigate(`/image/${round.image_id}`);

  return (
    <div style={wrapStyle}>
      <div
        style={{
          background: '#fff',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: isOpen
            ? '0 8px 32px rgba(67,56,202,0.18)'
            : '0 2px 12px rgba(0,0,0,0.08)',
          border: isOpen ? '2px solid #4338ca' : '1.5px solid #e5e7eb',
        }}
      >
        {/* 상단 띠 */}
        <div
          style={{
            background: isOpen ? '#4338ca' : '#6b7280',
            color: '#fff',
            padding: isMobile ? '10px 16px' : '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
          }}
        >
          <span style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {isOpen ? '🔥 오늘의 짤' : '🏆 지난 라운드 결과'}
          </span>
          {isOpen ? (
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                background: urgent ? '#ef4444' : 'rgba(255,255,255,0.18)',
                padding: '3px 10px',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
              }}
            >
              ⏳ {formatRemaining(remaining)}
            </span>
          ) : (
            <span style={{ fontSize: '13px', opacity: 0.85, whiteSpace: 'nowrap' }}>다음 라운드 준비 중</span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
          {/* 짤 */}
          <div
            onClick={goToRound}
            style={{
              width: isMobile ? '100%' : '340px',
              flexShrink: 0,
              cursor: 'pointer',
              background: '#f3f4f6',
            }}
          >
            <img
              src={IMAGE_URL(round.image_filename)}
              alt="오늘의 짤"
              style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }}
            />
          </div>

          {/* 정보 */}
          <div style={{ flex: 1, padding: pad, display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
            <div>
              <p style={{ margin: 0, fontSize: isMobile ? '16px' : '18px', fontWeight: 700, color: '#111827' }}>
                {isOpen ? '이 짤에 웃긴 멘트를 남겨보세요' : '이번 판 우승 멘트'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: '#6b7280' }}>
                🎙 지금까지 <b style={{ color: '#4338ca' }}>{round.entry_count}개</b>의 멘트가 올라왔어요
                {joined && <span style={{ color: '#10b981', fontWeight: 600 }}> · 참여 완료</span>}
              </p>
            </div>

            {/* 순위 미리보기 */}
            {top.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {top.map((entry, i) => {
                  const isWinner = !isOpen && entry.id === round.winner_response_id;
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        background: isWinner ? '#fef3c7' : '#f9fafb',
                        border: isWinner ? '1.5px solid #f59e0b' : '1px solid #f3f4f6',
                      }}
                    >
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>{MEDALS[i] ?? '🎙'}</span>
                      <button
                        onClick={() => togglePlay(entry)}
                        aria-label={playingId === entry.id ? '멈추기' : '들어보기'}
                        style={{
                          width: 30, height: 30, flexShrink: 0, borderRadius: '50%', border: 'none',
                          background: playingId === entry.id ? '#ef4444' : '#4338ca',
                          color: '#fff', fontSize: '12px', cursor: 'pointer', lineHeight: 1,
                        }}
                      >
                        {playingId === entry.id ? '■' : '▶'}
                      </button>
                      <span
                        style={{
                          flex: 1, minWidth: 0, fontSize: '13.5px', color: '#374151',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.nickname ?? '익명'}
                      </span>
                      <span style={{ fontSize: '13px', color: '#6b7280', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        ❤️ {entry.votes}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: '13.5px', color: '#9ca3af' }}>
                {isOpen ? '아직 아무도 멘트를 안 달았어요. 1등 하기 좋은 타이밍!' : '이 라운드엔 참여한 멘트가 없었어요.'}
              </p>
            )}

            <button
              onClick={goToRound}
              style={{
                marginTop: 'auto',
                padding: '13px',
                borderRadius: '50px',
                border: 'none',
                background: isOpen ? 'linear-gradient(135deg, #4338ca, #6366f1)' : '#6b7280',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: isOpen ? '0 4px 14px rgba(67,56,202,0.35)' : 'none',
              }}
            >
              {isOpen ? (joined ? '🎧 내 멘트 확인하기' : '🎤 멘트 남기기') : '결과 전체 보기'}
            </button>
          </div>
        </div>
      </div>

      <audio ref={audioRef} onEnded={() => setPlayingId(null)} style={{ display: 'none' }} />
    </div>
  );
}
