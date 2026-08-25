import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTodayRound, AUDIO_URL, IMAGE_URL } from '../api';
import type { DailyRound, RoundEntry } from '../types';

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

type Props = {
  isMobile: boolean;
  /** 데스크톱에서는 사이드 하단, 모바일에서는 CTA 아래에 붙는다 (짤 올리기 등) */
  children?: React.ReactNode;
};

export default function TodayRound({ isMobile, children }: Props) {
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

  const side = isMobile ? 18 : 56;
  const wrap: React.CSSProperties = {
    maxWidth: isMobile ? '560px' : '1280px',
    margin: '0 auto',
    padding: `${isMobile ? 16 : 30}px ${side}px 0`,
    fontFamily: 'var(--body)',
    color: 'var(--ink)',
  };

  // 아직 라운드가 등록되지 않은 상태
  if (!round) {
    return (
      <div style={wrap}>
        <div style={{
          border: '2.5px dashed var(--hairline)', padding: '28px 20px', textAlign: 'center',
          color: 'var(--faint)', fontSize: '13.5px', lineHeight: 1.6,
        }}>
          오늘의 짤이 아직 준비되지 않았어요
        </div>
        {children}
      </div>
    );
  }

  const isOpen = round.is_open;
  const remaining = new Date(round.closes_at).getTime() - now;
  const top = round.entries.slice(0, 3);
  const joined = Boolean(round.my_entry_id);
  const goToRound = () => navigate(`/image/${round.image_id}`);

  // ---------- 조각들 ----------

  const headline = (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
      <h2 style={{
        margin: 0, fontFamily: 'var(--display)', fontWeight: 400,
        fontSize: isMobile ? '34px' : '46px', lineHeight: 1.03, letterSpacing: '-0.025em',
      }}>
        {isOpen ? '오늘의 짤' : '지난 라운드'}
      </h2>
      <div style={{
        border: '2.5px solid var(--ink)', background: 'var(--panel)',
        padding: isMobile ? '5px 10px' : '6px 12px', textAlign: 'center', flexShrink: 0,
      }}>
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', color: 'var(--muted)' }}>
          {isOpen ? '마감까지' : '마감됨'}
        </div>
        <div style={{
          fontFamily: 'var(--display)', fontSize: isMobile ? '19px' : '22px', lineHeight: 1.15,
          color: 'var(--amber-deep)', fontVariantNumeric: 'tabular-nums',
        }}>
          {isOpen ? formatRemaining(remaining) : formatDate(round.closes_at)}
        </div>
      </div>
    </div>
  );

  const stage = (
    <div style={{ position: 'relative' }}>
      <div
        onClick={goToRound}
        style={{
          border: '3px solid var(--ink)', background: 'var(--stage)',
          overflow: 'hidden', position: 'relative', cursor: 'pointer',
        }}
      >
        <div style={{
          position: 'absolute', top: isMobile ? '-90px' : '-150px', left: '50%', transform: 'translateX(-50%)',
          width: isMobile ? '460px' : '900px', height: isMobile ? '300px' : '520px', pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(232,144,28,0.34) 0%, rgba(232,144,28,0.08) 46%, rgba(232,144,28,0) 72%)',
        }} />
        <img
          src={IMAGE_URL(round.image_filename)}
          alt="오늘의 짤"
          style={{
            display: 'block', width: '100%', aspectRatio: '16/10',
            objectFit: 'contain', position: 'relative',
          }}
        />
      </div>
      <div style={{
        position: 'absolute', right: isMobile ? '-3px' : '-6px', bottom: isMobile ? '-13px' : '-15px',
        background: 'var(--panel)', border: '2.5px solid var(--ink)',
        padding: isMobile ? '5px 11px' : '7px 14px',
        fontSize: isMobile ? '12px' : '13px', fontWeight: 700,
        transform: 'rotate(-1.5deg)', whiteSpace: 'nowrap',
      }}>
        {round.entry_count > 0 ? `${round.entry_count}명 참여` : '아직 아무도 없음'}
        {joined && <span style={{ color: 'var(--amber-deep)' }}> · 참여 완료</span>}
      </div>
    </div>
  );

  const cta = (
    <button
      onClick={goToRound}
      style={{
        width: '100%', height: isMobile ? 58 : 62, cursor: 'pointer',
        border: '3px solid var(--ink)',
        background: isOpen ? 'var(--amber)' : 'var(--panel)',
        color: 'var(--ink)', fontFamily: 'var(--display)', fontSize: isMobile ? '19px' : '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        boxShadow: '5px 5px 0 var(--ink)',
      }}
    >
      {isOpen && (
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <rect x="9" y="2" width="6" height="11" rx="3" />
          <path d="M5 10a7 7 0 0 0 14 0" />
          <path d="M12 17v4" />
        </svg>
      )}
      {isOpen ? (joined ? '내 멘트 확인하기' : '멘트 남기기') : '결과 전체 보기'}
    </button>
  );

  const board = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '7px' : '8px' }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        borderBottom: '2.5px solid var(--ink)', paddingBottom: '7px',
      }}>
        <span style={{ fontFamily: 'var(--display)', fontSize: isMobile ? '16px' : '18px' }}>
          {isOpen ? '중간 집계' : '최종 집계'}
        </span>
        <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>멘트 {round.entry_count}개</span>
      </div>

      {top.length > 0 ? top.map((entry) => {
        const isWinner = !isOpen && entry.id === round.winner_response_id;
        const lead = entry.rank === 1 || isWinner;
        const playing = playingId === entry.id;
        return (
          <div
            key={entry.id}
            style={{
              display: 'flex', alignItems: 'center', gap: isMobile ? '11px' : '12px',
              border: '2.5px solid var(--ink)',
              background: lead ? 'var(--amber-tint)' : 'var(--panel)',
              padding: isMobile ? '6px 11px' : '7px 13px',
            }}
          >
            <span style={{
              fontFamily: 'var(--display)', fontSize: isMobile ? '18px' : '19px',
              width: isMobile ? '14px' : '16px', color: lead ? 'var(--ink)' : 'var(--muted)',
            }}>
              {entry.rank}
            </span>
            <button
              onClick={() => togglePlay(entry)}
              aria-label={`${entry.nickname ?? '익명'} 멘트 ${playing ? '정지' : '듣기'}`}
              style={{
                width: 44, height: 44, flexShrink: 0, padding: 0, cursor: 'pointer',
                border: '2.5px solid var(--ink)',
                background: playing ? '#C9302B' : lead ? 'var(--amber)' : 'var(--panel)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={playing ? '#FAF8F3' : 'var(--ink)'}>
                <path d={playing ? 'M7 7h10v10H7z' : 'M8 5v14l11-7z'} />
              </svg>
            </button>
            <span style={{
              flex: 1, minWidth: 0, fontSize: isMobile ? '13.5px' : '14.5px', fontWeight: 600,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {entry.nickname ?? '익명'}
            </span>
            <span style={{ fontSize: isMobile ? '13px' : '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {entry.votes}표
            </span>
          </div>
        );
      }) : (
        <div style={{
          border: '2.5px dashed var(--hairline)', padding: '20px',
          textAlign: 'center', fontSize: '13px', color: 'var(--faint)',
        }}>
          {isOpen ? '아직 아무도 멘트를 안 달았어요. 1등 하기 좋은 타이밍!' : '이 라운드엔 참여한 멘트가 없었어요.'}
        </div>
      )}
    </div>
  );

  const audio = <audio ref={audioRef} onEnded={() => setPlayingId(null)} style={{ display: 'none' }} />;

  // ---------- 배치 ----------

  // PC: 짤이 큰 사진처럼 왼쪽, 오른쪽이 마감·CTA·집계를 받는 사이드.
  // CTA 를 집계 위에 두는 이유 — 세로가 넉넉해서 순위를 다 읽고 나서야 버튼을 만나면 늦다.
  if (!isMobile) {
    return (
      <div style={wrap}>
        <div style={{ display: 'flex', gap: '26px', alignItems: 'flex-start' }}>
          <div style={{ flex: '0 0 60%', minWidth: 0 }}>{stage}</div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {headline}
            {cta}
            {board}
            {children}
          </div>
        </div>
        {audio}
      </div>
    );
  }

  // 폰: 위에서 아래로 한 줄
  return (
    <div style={wrap}>
      {headline}
      <div style={{ marginTop: '13px' }}>{stage}</div>
      <div style={{ marginTop: '26px' }}>{board}</div>
      <div style={{ marginTop: '18px' }}>{cta}</div>
      {children}
      {audio}
    </div>
  );
}
