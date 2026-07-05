const { Pool } = require('pg');

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

    ALTER TABLE comments ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id);

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
  `);
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

  async getImage(id) {
    const { rows: images } = await pool.query('SELECT * FROM images WHERE id = $1', [id]);
    if (!images[0]) return null;
    const { rows: responses } = await pool.query(
      'SELECT * FROM responses WHERE image_id = $1 ORDER BY votes DESC, created_at DESC',
      [id]
    );
    return { ...images[0], responses };
  },

  async addImage({ id, filename, original_name }) {
    await pool.query(
      'INSERT INTO images (id, filename, original_name) VALUES ($1, $2, $3)',
      [id, filename, original_name]
    );
  },

  async addResponse({ id, image_id, type, audio_filename, ai_text }) {
    await pool.query(
      'INSERT INTO responses (id, image_id, type, audio_filename, ai_text) VALUES ($1, $2, $3, $4, $5)',
      [id, image_id, type, audio_filename, ai_text ?? null]
    );
  },

  async vote(responseId) {
    const { rows } = await pool.query(
      'UPDATE responses SET votes = votes + 1 WHERE id = $1 RETURNING votes',
      [responseId]
    );
    return rows[0]?.votes ?? null;
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

  async addComment({ id, image_id, user_id, nickname, text }) {
    const { rows } = await pool.query(
      'INSERT INTO comments (id, image_id, user_id, nickname, text) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, image_id, user_id, nickname, text]
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
};

module.exports = db;
