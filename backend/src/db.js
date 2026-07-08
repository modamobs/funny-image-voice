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

  async addResponse({ id, image_id, type, audio_filename, ai_text, user_id }) {
    await pool.query(
      'INSERT INTO responses (id, image_id, type, audio_filename, ai_text, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, image_id, type, audio_filename, ai_text ?? null, user_id ?? null]
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
