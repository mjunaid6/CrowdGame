const knex = require('knex');
const config = require('../config');

let db;

if (config.DATABASE_URL) {
  console.log('Connecting to PostgreSQL database...');
  db = knex({
    client: 'pg',
    connection: {
      connectionString: config.DATABASE_URL,
      ssl: config.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    },
    pool: { min: 2, max: 10 }
  });
} else if (config.USE_SQLITE_FALLBACK) {
  console.log(`DATABASE_URL not set. Falling back to SQLite at: ${config.SQLITE_PATH}`);
  db = knex({
    client: 'sqlite3',
    connection: {
      filename: config.SQLITE_PATH
    },
    useNullAsDefault: true
  });
} else {
  console.warn('Database is disabled or not configured properly. DB operations will fail.');
}

// Function to initialize schema if it doesn't exist
async function initSchema() {
  if (!db) return;
  
  try {
    // 1. Events table
    const hasEvents = await db.schema.hasTable('events');
    if (!hasEvents) {
      await db.schema.createTable('events', (table) => {
        table.uuid('id').primary();
        table.string('name').notNullable();
        table.string('admin_password_hash').notNullable();
        table.string('branding_logo_url').nullable();
        table.string('branding_color').nullable();
        table.timestamps(true, true);
        table.timestamp('expires_at').nullable();
      });
      console.log('Created table: events');
    }

    // 2. Rooms table
    const hasRooms = await db.schema.hasTable('rooms');
    if (!hasRooms) {
      await db.schema.createTable('rooms', (table) => {
        table.uuid('id').primary();
        table.uuid('event_id').nullable().references('id').inTable('events').onDelete('SET NULL');
        table.string('room_code', 10).unique().notNullable();
        table.string('activity_type', 50).notNullable();
        table.text('activity_config').nullable(); // JSON string
        table.string('status', 20).defaultTo('waiting'); // waiting, active, completed
        table.timestamp('started_at').nullable();
        table.timestamp('completed_at').nullable();
        table.timestamps(true, true);
      });
      console.log('Created table: rooms');
    }

    // 3. Participants table
    const hasParticipants = await db.schema.hasTable('participants');
    if (!hasParticipants) {
      await db.schema.createTable('participants', (table) => {
        table.uuid('id').primary();
        table.uuid('room_id').references('id').inTable('rooms').onDelete('CASCADE');
        table.string('display_name', 50).notNullable();
        table.string('color', 10).notNullable();
        table.string('socket_id', 50).nullable();
        table.integer('score').defaultTo(0);
        table.boolean('is_connected').defaultTo(true);
        table.timestamp('joined_at').defaultTo(db.fn.now());
      });
      console.log('Created table: participants');
    }

    // 4. Puzzle States table
    const hasPuzzleStates = await db.schema.hasTable('puzzle_states');
    if (!hasPuzzleStates) {
      await db.schema.createTable('puzzle_states', (table) => {
        table.uuid('id').primary();
        table.uuid('room_id').references('id').inTable('rooms').onDelete('CASCADE');
        table.string('image_url', 255).notNullable();
        table.integer('rows').notNullable();
        table.integer('cols').notNullable();
        table.text('pieces_state').nullable(); // JSON string (coordinates, who placed, etc.)
        table.integer('pieces_placed').defaultTo(0);
        table.integer('total_pieces').notNullable();
        table.timestamp('completed_at').nullable();
      });
      console.log('Created table: puzzle_states');
    }

    // 5. Global leaderboard table (new)
    const lbService = require('../routes/leaderboard');
    await lbService.ensureTable();

    console.log('Database schema initialization completed.');
  } catch (error) {
    console.error('Error initializing database schema:', error);
  }
}

module.exports = {
  db,
  initSchema
};
