const { Pool } = require('pg');

// 일일 라운드 스케줄. 기본: 매일 09:00 시작 → 21:00 마감 (한국 시간)
const ROUND_TZ = process.env.ROUND_TZ ?? 'Asia/Seoul';
const ROUND_OPEN_HOUR = Number(process.env.ROUND_OPEN_HOUR ?? 9);
const ROUND_CLOSE_HOUR = Number(process.env.ROUND_CLOSE_HOUR ?? 21);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS images (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('ai', 'user')),
      audio_filename TEXT NOT NULL,
      ai_text TEXT,
      votes INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      nickname TEXT NOT NULL DEFAULT '익명',
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      picture TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ai_usage (
      user_id TEXT NOT NULL REFERENCES users(id),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
      comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (comment_id, user_id)
    );

    ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);
    ALTER TABLE responses ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE;
    ALTER TABLE images ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);
    ALTER TABLE comments ADD COLUMN IF NOT EXISTS country_code TEXT;

    CREATE TABLE IF NOT EXISTS response_votes (
      response_id TEXT NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (response_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS ai_image_usage (
      user_id TEXT NOT NULL REFERENCES users(id),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, date)
    );

    -- 일일 라운드: 하루에 짤 한 장, 모두가 같은 판에서 겨룬다
    CREATE TABLE IF NOT EXISTS daily_rounds (
      id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
      opens_at TIMESTAMPTZ NOT NULL,
      closes_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'closed')),
      winner_response_id TEXT REFERENCES responses(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- 동시에 열려 있는 라운드는 항상 하나뿐이어야 한다
    CREATE UNIQUE INDEX IF NOT EXISTS daily_rounds_single_open
      ON daily_rounds (status) WHERE status = 'open';
    CREATE INDEX IF NOT EXISTS daily_rounds_opens_at_idx ON daily_rounds (opens_at DESC);

    -- 멘트가 어느 라운드에 속하는지. 라운드 밖에서 달린 멘트는 NULL
    ALTER TABLE responses ADD COLUMN IF NOT EXISTS round_id TEXT REFERENCES daily_rounds(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS responses_round_idx ON responses (round_id);
  `);
}

// 한 라운드에 달린 멘트를 전부 읽는다. 표시 순서는 득표순.
async function loadEntries(roundId, userId) {
  const { rows } = await pool.query(
    `SELECT r.id, r.type, r.audio_filename, r.ai_text, r.votes, r.created_at, r.user_id,
            u.name AS nickname, u.picture,
            (rv.user_id IS NOT NULL) AS voted_by_me
     FROM responses r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN response_votes rv ON rv.response_id = r.id AND rv.user_id = $2
     WHERE r.round_id = $1
     ORDER BY r.votes DESC, r.created_at ASC`,
    [roundId, userId]
  );
  return rows;
}

// 동점은 같은 등수, 다음 등수는 건너뛴다 (1, 2, 2, 4)
function withRank(entries) {
  let rank = 0;
  let prevVotes = null;
  return entries.map((entry, i) => {
    if (entry.votes !== prevVotes) {
      rank = i + 1;
      prevVotes = entry.votes;
    }
    return { ...entry, rank };
  });
}

// AI 멘트는 유저 순위와 섞지 않고 따로 담는다
async function composeRound(round, userId) {
  const all = await loadEntries(round.id, userId);
  const entries = withRank(all.filter((e) => e.type === 'user'));
  return {
    ...round,
    is_open: round.status === 'open',
    entry_count: entries.length,
    my_entry_id: userId ? (entries.find((e) => e.user_id === userId)?.id ?? null) : null,
    entries,
    ai_entries: all.filter((e) => e.type === 'ai'),
    winner: round.winner_response_id
      ? (all.find((e) => e.id === round.winner_response_id) ?? null)
      : null,
  };
}

const db = {
  init,

  async getImages() {
    const { rows } = await pool.query(`
      SELECT i.*, COUNT(r.id)::int AS response_count
      FROM images i
      LEFT JOIN responses r ON i.id = r.image_id
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `);
    return rows;
  },

  async getImage(id, userId = null) {
    const { rows: images } = await pool.query('SELECT * FROM images WHERE id = $1', [id]);
    if (!images[0]) return null;
    const { rows: responses } = await pool.query(
      `SELECT r.*, u.name AS nickname,
              (rv.user_id IS NOT NULL) AS voted_by_me
       FROM responses r
       LEFT JOIN users u ON u.id = r.user_id
       LEFT JOIN response_votes rv ON rv.response_id = r.id AND rv.user_id = $2
       WHERE r.image_id = $1
       ORDER BY r.created_at ASC`,
      [id, userId]
    );
    return { ...images[0], responses };
  },

  async addImage({ id, filename, original_name, user_id }) {
    await pool.query(
      'INSERT INTO images (id, filename, original_name, user_id) VALUES ($1, $2, $3, $4)',
      [id, filename, original_name, user_id ?? null]
    );
  },

  async addResponse({ id, image_id, type, audio_filename, ai_text, user_id, round_id }) {
    await pool.query(
      'INSERT INTO responses (id, image_id, type, audio_filename, ai_text, user_id, round_id) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [id, image_id, type, audio_filename, ai_text ?? null, user_id ?? null, round_id ?? null]
    );
  },

  async deleteResponse(id, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM responses WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },

  async vote(responseId, userId) {
    const { rowCount } = await pool.query(
      'INSERT INTO response_votes (response_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [responseId, userId]
    );
    if (rowCount === 0) {
      // 이미 투표함
      const { rows } = await pool.query('SELECT votes FROM responses WHERE id = $1', [responseId]);
      return { votes: rows[0]?.votes ?? 0, already_voted: true };
    }
    const { rows } = await pool.query(
      'UPDATE responses SET votes = votes + 1 WHERE id = $1 RETURNING votes',
      [responseId]
    );
    return { votes: rows[0]?.votes ?? 0, already_voted: false };
  },

  async getComments(imageId, userId = null) {
    const { rows } = await pool.query(
      `SELECT c.*,
              COUNT(cl.user_id)::int AS likes,
              BOOL_OR(cl.user_id = $2) AS liked_by_me
       FROM comments c
       LEFT JOIN comment_likes cl ON cl.comment_id = c.id
       WHERE c.image_id = $1
       GROUP BY c.id
       ORDER BY c.created_at ASC`,
      [imageId, userId]
    );
    return rows;
  },

  async addComment({ id, image_id, user_id, nickname, text, parent_id, country_code }) {
    const { rows } = await pool.query(
      'INSERT INTO comments (id, image_id, user_id, nickname, text, parent_id, country_code) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, image_id, user_id, nickname, text, parent_id ?? null, country_code ?? null]
    );
    return rows[0];
  },

  async updateComment(id, userId, text) {
    const { rows } = await pool.query(
      'UPDATE comments SET text = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [text, id, userId]
    );
    return rows[0] ?? null;
  },

  async deleteComment(id, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM comments WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    return rowCount > 0;
  },

  async upsertUser({ id, google_id, email, name, picture }) {
    const { rows } = await pool.query(
      `INSERT INTO users (id, google_id, email, name, picture)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (google_id) DO UPDATE SET name=$4, picture=$5
       RETURNING *`,
      [id, google_id, email, name, picture]
    );
    return rows[0];
  },

  async getUserById(id) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ?? null;
  },

  async getAiUsageToday(userId) {
    const { rows } = await pool.query(
      `SELECT count FROM ai_usage WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId]
    );
    return rows[0]?.count ?? 0;
  },

  async toggleCommentLike(commentId, userId) {
    const { rowCount } = await pool.query(
      'DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
      [commentId, userId]
    );
    if (rowCount === 0) {
      await pool.query(
        'INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)',
        [commentId, userId]
      );
    }
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS likes FROM comment_likes WHERE comment_id = $1',
      [commentId]
    );
    return { likes: rows[0].likes, liked: rowCount === 0 };
  },

  async incrementAiUsage(userId) {
    await pool.query(
      `INSERT INTO ai_usage (user_id, date, count) VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (user_id, date) DO UPDATE SET count = ai_usage.count + 1`,
      [userId]
    );
  },

  async getAiImageUsageToday(userId) {
    const { rows } = await pool.query(
      `SELECT count FROM ai_image_usage WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId]
    );
    return rows[0]?.count ?? 0;
  },

  async incrementAiImageUsage(userId) {
    await pool.query(
      `INSERT INTO ai_image_usage (user_id, date, count) VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (user_id, date) DO UPDATE SET count = ai_image_usage.count + 1`,
      [userId]
    );
  },

  // ---------- 일일 라운드 ----------

  // 스케줄대로 라운드 상태를 맞춘다. 멱등이라 크론 없이 읽기 시점에 불러도 된다.
  async syncRounds() {
    // 1) 마감 시각이 지난 라운드를 닫으면서 우승 멘트를 확정한다
    await pool.query(`
      UPDATE daily_rounds SET status = 'closed',
        winner_response_id = (
          SELECT r.id FROM responses r
          WHERE r.round_id = daily_rounds.id AND r.type = 'user'
          ORDER BY r.votes DESC, r.created_at ASC
          LIMIT 1
        )
      WHERE status = 'open' AND closes_at <= NOW()
    `);
    // 2) 열리지도 못하고 마감 시각까지 지난 예약 라운드는 그냥 닫는다
    await pool.query(
      `UPDATE daily_rounds SET status = 'closed' WHERE status = 'scheduled' AND closes_at <= NOW()`
    );
    // 3) 지금 진행돼야 할 예약 라운드를 연다. 열린 라운드가 없을 때만.
    await pool.query(`
      UPDATE daily_rounds SET status = 'open'
      WHERE id = (
        SELECT id FROM daily_rounds
        WHERE status = 'scheduled' AND opens_at <= NOW() AND closes_at > NOW()
        ORDER BY opens_at DESC
        LIMIT 1
      )
      AND NOT EXISTS (SELECT 1 FROM daily_rounds WHERE status = 'open')
    `);
  },

  // 기본 라운드 시간대를 계산한다. dayOffset=1 이면 내일 09:00~21:00.
  async roundWindow(dayOffset = 0) {
    const { rows } = await pool.query(
      `SELECT (date_trunc('day', (NOW() AT TIME ZONE $1)) + make_interval(days := $2::int, hours := $3::int)) AT TIME ZONE $1 AS opens_at,
              (date_trunc('day', (NOW() AT TIME ZONE $1)) + make_interval(days := $2::int, hours := $4::int)) AT TIME ZONE $1 AS closes_at`,
      [ROUND_TZ, dayOffset, ROUND_OPEN_HOUR, ROUND_CLOSE_HOUR]
    );
    return rows[0];
  },

  // 진행 중인 라운드. 없으면 가장 최근에 끝난 라운드를 대신 보여준다.
  async getCurrentRound(userId = null) {
    await db.syncRounds();
    const { rows } = await pool.query(`
      SELECT dr.*, i.filename AS image_filename, i.original_name AS image_name
      FROM daily_rounds dr
      JOIN images i ON i.id = dr.image_id
      WHERE dr.status IN ('open', 'closed')
      ORDER BY (dr.status = 'open') DESC, dr.opens_at DESC
      LIMIT 1
    `);
    if (!rows[0]) return null;
    return composeRound(rows[0], userId);
  },

  async getRound(id, userId = null) {
    const { rows } = await pool.query(
      `SELECT dr.*, i.filename AS image_filename, i.original_name AS image_name
       FROM daily_rounds dr
       JOIN images i ON i.id = dr.image_id
       WHERE dr.id = $1`,
      [id]
    );
    if (!rows[0]) return null;
    return composeRound(rows[0], userId);
  },

  // 명예의 전당: 끝난 라운드 목록
  async listRounds(limit = 30) {
    const { rows } = await pool.query(
      `SELECT dr.id, dr.status, dr.opens_at, dr.closes_at, dr.winner_response_id,
              i.filename AS image_filename,
              COUNT(r.id) FILTER (WHERE r.type = 'user')::int AS entry_count
       FROM daily_rounds dr
       JOIN images i ON i.id = dr.image_id
       LEFT JOIN responses r ON r.round_id = dr.id
       WHERE dr.status = 'closed'
       GROUP BY dr.id, i.filename
       ORDER BY dr.opens_at DESC
       LIMIT $1`,
      [limit]
    );
    return rows;
  },

  // 이 이미지가 지금 열린 라운드의 짤인지 확인한다. 멘트에 round_id 를 찍을 때 쓴다.
  async getOpenRoundForImage(imageId) {
    const { rows } = await pool.query(
      `SELECT * FROM daily_rounds WHERE status = 'open' AND image_id = $1 AND closes_at > NOW()`,
      [imageId]
    );
    return rows[0] ?? null;
  },

  async createRound({ id, image_id, opens_at, closes_at }) {
    const { rows } = await pool.query(
      `INSERT INTO daily_rounds (id, image_id, opens_at, closes_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, image_id, opens_at, closes_at]
    );
    return rows[0];
  },

  // 마감 시각 전에 관리자가 강제로 닫을 때
  async closeRound(id) {
    const { rows } = await pool.query(
      `UPDATE daily_rounds SET status = 'closed',
         winner_response_id = (
           SELECT r.id FROM responses r
           WHERE r.round_id = daily_rounds.id AND r.type = 'user'
           ORDER BY r.votes DESC, r.created_at ASC
           LIMIT 1
         )
       WHERE id = $1 AND status <> 'closed'
       RETURNING *`,
      [id]
    );
    return rows[0] ?? null;
  },

  async adminListRounds() {
    const { rows } = await pool.query(`
      SELECT dr.*, i.filename AS image_filename, i.original_name AS image_name,
             COUNT(r.id) FILTER (WHERE r.type = 'user')::int AS entry_count
      FROM daily_rounds dr
      JOIN images i ON i.id = dr.image_id
      LEFT JOIN responses r ON r.round_id = dr.id
      GROUP BY dr.id, i.filename, i.original_name
      ORDER BY dr.opens_at DESC
      LIMIT 60
    `);
    return rows;
  },

  // 아직 시작 안 한 라운드만 지울 수 있다. 지난 라운드는 기록으로 남긴다.
  async deleteScheduledRound(id) {
    const { rowCount } = await pool.query(
      `DELETE FROM daily_rounds WHERE id = $1 AND status = 'scheduled'`,
      [id]
    );
    return rowCount > 0;
  },

  async adminStats() {
    const { rows } = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM images) AS images,
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM comments WHERE parent_id IS NULL) AS comments,
        (SELECT COUNT(*)::int FROM comments WHERE parent_id IS NOT NULL) AS replies,
        (SELECT COUNT(*)::int FROM responses) AS responses
    `);
    return rows[0];
  },

  async adminGetImages() {
    const { rows } = await pool.query(`
      SELECT i.*,
        COUNT(DISTINCT r.id)::int AS response_count,
        COUNT(DISTINCT c.id)::int AS comment_count
      FROM images i
      LEFT JOIN responses r ON r.image_id = i.id
      LEFT JOIN comments c ON c.image_id = i.id AND c.parent_id IS NULL
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `);
    return rows;
  },

  async adminDeleteImage(id) {
    const { rowCount } = await pool.query('DELETE FROM images WHERE id = $1', [id]);
    return rowCount > 0;
  },

  async adminGetUsers() {
    const { rows } = await pool.query(`
      SELECT u.*,
        COUNT(DISTINCT c.id)::int AS comment_count,
        COUNT(DISTINCT r.id)::int AS response_count
      FROM users u
      LEFT JOIN comments c ON c.user_id = u.id
      LEFT JOIN responses r ON r.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    return rows;
  },

  async adminGetComments() {
    const { rows } = await pool.query(`
      SELECT c.*, u.email AS user_email, u.picture AS user_picture, i.original_name AS image_name
      FROM comments c
      LEFT JOIN users u ON u.id = c.user_id
      LEFT JOIN images i ON i.id = c.image_id
      ORDER BY c.created_at DESC
      LIMIT 200
    `);
    return rows;
  },

  async adminDeleteComment(id) {
    const { rowCount } = await pool.query('DELETE FROM comments WHERE id = $1', [id]);
    return rowCount > 0;
  },

  async adminGetResponses() {
    const { rows } = await pool.query(`
      SELECT r.*, u.email AS user_email, u.name AS user_name, i.original_name AS image_name
      FROM responses r
      LEFT JOIN users u ON u.id = r.user_id
      LEFT JOIN images i ON i.id = r.image_id
      ORDER BY r.created_at DESC
      LIMIT 200
    `);
    return rows;
  },

  async adminDeleteResponse(id) {
    const { rowCount } = await pool.query('DELETE FROM responses WHERE id = $1', [id]);
    return rowCount > 0;
  },

  async profileImages(userId) {
    const { rows } = await pool.query(
      `SELECT i.*, COUNT(r.id)::int AS response_count
       FROM images i
       LEFT JOIN responses r ON i.id = r.image_id
       WHERE i.user_id = $1
       GROUP BY i.id
       ORDER BY i.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async profileComments(userId) {
    const { rows } = await pool.query(
      `SELECT c.*, i.filename AS image_filename, i.id AS image_id
       FROM comments c
       JOIN images i ON i.id = c.image_id
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId]
    );
    return rows;
  },

  async profileResponses(userId) {
    const { rows } = await pool.query(
      `SELECT r.*, i.filename AS image_filename, i.id AS image_id
       FROM responses r
       JOIN images i ON i.id = r.image_id
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );
    return rows;
  },
};

module.exports = db;
