/**
 * Global Leaderboard Service
 * Manages persistent all-time top scores across all rooms and sessions.
 * Uses the existing DB (SQLite in dev, Postgres in prod) via knex.
 */

const { db } = require('./db');

/**
 * Ensure the global_leaderboard table exists.
 * Called during server bootstrap (initSchema).
 */
async function ensureTable() {
  if (!db) return;
  const exists = await db.schema.hasTable('global_leaderboard');
  if (!exists) {
    await db.schema.createTable('global_leaderboard', (t) => {
      t.increments('id').primary();
      t.string('display_name', 50).notNullable();
      t.integer('score').notNullable().defaultTo(0);
      t.integer('pieces_placed').notNullable().defaultTo(0);
      t.string('room_code', 10).notNullable();
      t.integer('total_players').notNullable().defaultTo(1);
      t.integer('total_pieces').notNullable().defaultTo(0);
      // Duration in seconds from game start to completion
      t.integer('solve_duration_secs').nullable();
      t.timestamp('achieved_at').defaultTo(db.fn.now());
    });
    console.log('Created table: global_leaderboard');
  }
}

/**
 * Record a completed game's results into the global leaderboard.
 * @param {object} opts
 * @param {Array}  opts.leaderboard   - [{displayName, score, color}, ...]
 * @param {string} opts.roomCode
 * @param {number} opts.totalPieces
 * @param {number} opts.solveDurationSecs
 */
async function recordGame({ leaderboard, roomCode, totalPieces, solveDurationSecs }) {
  if (!db || !leaderboard || !leaderboard.length) return;

  const totalPlayers = leaderboard.length;

  const rows = leaderboard.map((entry) => ({
    display_name: entry.displayName,
    score: entry.score || 0,
    pieces_placed: entry.score || 0, // score == pieces placed for jigsaw
    room_code: roomCode,
    total_players: totalPlayers,
    total_pieces: totalPieces || 0,
    solve_duration_secs: solveDurationSecs || null,
    achieved_at: new Date().toISOString(),
  }));

  await db('global_leaderboard').insert(rows);
}

/**
 * Retrieve the top N all-time scores.
 * @param {number} limit  default 20
 * @returns {Promise<Array>}
 */
async function getTopScores(limit = 20) {
  if (!db) return [];
  return db('global_leaderboard')
    .select(
      'display_name',
      'score',
      'pieces_placed',
      'room_code',
      'total_players',
      'total_pieces',
      'solve_duration_secs',
      'achieved_at'
    )
    .orderBy('score', 'desc')
    .limit(limit);
}

/**
 * Get a summary of a player's personal best across all sessions.
 * @param {string} displayName  case-insensitive match
 */
async function getPlayerBest(displayName) {
  if (!db) return null;
  return db('global_leaderboard')
    .where(db.raw('LOWER(display_name)'), displayName.toLowerCase())
    .orderBy('score', 'desc')
    .first();
}

/**
 * Get global stats (total games, total solvers, fastest solve).
 */
async function getGlobalStats() {
  if (!db) return {};

  const [totals] = await db('global_leaderboard')
    .count('* as total_entries')
    .sum('score as total_score');

  const fastest = await db('global_leaderboard')
    .whereNotNull('solve_duration_secs')
    .orderBy('solve_duration_secs', 'asc')
    .first('solve_duration_secs', 'room_code', 'achieved_at');

  return {
    totalEntries: parseInt(totals.total_entries, 10) || 0,
    totalScore: parseInt(totals.total_score, 10) || 0,
    fastestSolveSecs: fastest ? fastest.solve_duration_secs : null,
  };
}

module.exports = { ensureTable, recordGame, getTopScores, getPlayerBest, getGlobalStats };
