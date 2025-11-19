const { execFile } = require('child_process');
const { generateId } = require('../utils/ids');
const { loadEnv } = require('../loadEnv');

loadEnv();

const DATABASE_URL = process.env.DATABASE_URL;
const PSQL_PATH = process.env.PSQL_PATH || 'psql';
const MAX_BUFFER = 10 * 1024 * 1024;

if (!DATABASE_URL) {
  console.warn('DATABASE_URL is not defined. Database operations will fail until it is configured.');
}

function execPsql(sql) {
  return new Promise((resolve, reject) => {
    if (!DATABASE_URL) {
      reject(new Error('DATABASE_URL environment variable is not configured.'));
      return;
    }

    const args = ['-X', '--tuples-only', '--no-align', '--set', 'ON_ERROR_STOP=1', '-d', DATABASE_URL, '-c', sql];
    execFile(PSQL_PATH, args, { maxBuffer: MAX_BUFFER }, (error, stdout, stderr) => {
      if (error) {
        const details = new Error(stderr || error.message);
        details.stack = error.stack;
        reject(details);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  players JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON sessions (created_at DESC);
`;

let schemaReadyPromise;
function ensureDatabase() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = execPsql(SCHEMA_SQL);
  }
  return schemaReadyPromise;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonLiteral(value) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function normalizeSession(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    settings: row.settings || {},
    players: Array.isArray(row.players) ? row.players : [],
  };
}

function buildSessionPayload(payload = {}) {
  const timestamp = new Date().toISOString();
  const settings = {
    hostName: '',
    location: '',
    datetime: '',
    expenses: '',
    reportedFinal: '',
    currency: 'USD',
    sessionStatus: 'open',
    ...(payload.settings || {}),
  };

  const players = Array.isArray(payload.players) ? payload.players : [];

  return {
    id: payload.id || generateId('session'),
    createdAt: payload.createdAt || timestamp,
    updatedAt: payload.updatedAt || timestamp,
    settings,
    players,
  };
}

async function getSessions() {
  await ensureDatabase();
  const sql = `SELECT COALESCE(json_agg(row_to_json(s)), '[]'::json) FROM (SELECT id, created_at, updated_at, settings, players FROM sessions ORDER BY created_at DESC) AS s;`;
  const payload = await execPsql(sql);
  return JSON.parse(payload || '[]').map(normalizeSession);
}

async function getSessionById(id) {
  await ensureDatabase();
  const sql = `SELECT row_to_json(s) FROM (SELECT id, created_at, updated_at, settings, players FROM sessions WHERE id = ${sqlLiteral(id)} LIMIT 1) AS s;`;
  const payload = await execPsql(sql);
  if (!payload) {
    return null;
  }
  const parsed = JSON.parse(payload);
  if (!parsed) {
    return null;
  }
  return normalizeSession(parsed);
}

async function createSession(payload) {
  const session = buildSessionPayload(payload);
  await ensureDatabase();
  const sql = `
    INSERT INTO sessions (id, created_at, updated_at, settings, players)
    VALUES (
      ${sqlLiteral(session.id)},
      ${sqlLiteral(session.createdAt)},
      ${sqlLiteral(session.updatedAt)},
      ${jsonLiteral(session.settings)},
      ${jsonLiteral(session.players)}
    )
    ON CONFLICT (id) DO UPDATE SET
      updated_at = EXCLUDED.updated_at,
      settings = EXCLUDED.settings,
      players = EXCLUDED.players
    RETURNING row_to_json(sessions.*);
  `;
  const inserted = await execPsql(sql);
  return normalizeSession(JSON.parse(inserted));
}

async function updateSession(id, payload) {
  const existing = await getSessionById(id);
  if (!existing) {
    return null;
  }
  const merged = buildSessionPayload({
    ...existing,
    ...payload,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    settings: {
      ...existing.settings,
      ...(payload.settings || {}),
    },
    players: Array.isArray(payload.players) ? payload.players : existing.players,
  });

  await ensureDatabase();
  const sql = `
    UPDATE sessions
    SET
      updated_at = ${sqlLiteral(merged.updatedAt)},
      settings = ${jsonLiteral(merged.settings)},
      players = ${jsonLiteral(merged.players)}
    WHERE id = ${sqlLiteral(merged.id)}
    RETURNING row_to_json(sessions.*);
  `;
  const updated = await execPsql(sql);
  return normalizeSession(JSON.parse(updated));
}

module.exports = {
  ensureDatabase,
  getSessions,
  getSessionById,
  createSession,
  updateSession,
};
