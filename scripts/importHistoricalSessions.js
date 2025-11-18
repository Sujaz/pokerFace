const fs = require('fs').promises;
const path = require('path');
const { loadEnv } = require('../loadEnv');
const { createSession } = require('../db');
const { generateId } = require('../utils/ids');

loadEnv();

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'historicalSessions.csv');

function parseCsv(content) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(current);
      current = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    if (char === '\n') {
      row.push(current);
      if (row.some((value) => value.trim() !== '')) {
        rows.push(row);
      }
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current || row.length) {
    row.push(current);
    if (row.some((value) => value.trim() !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

function toObject(rows) {
  if (!rows.length) {
    return [];
  }
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((line) => {
    const entry = {};
    headers.forEach((header, idx) => {
      entry[header] = line[idx] ? line[idx].trim() : '';
    });
    return entry;
  });
}

function safeNumber(value) {
  if (value === undefined || value === null || value === '') {
    return 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeStatus(value) {
  const lowered = (value || '').toString().toLowerCase();
  if (lowered === 'closed' || lowered === 'open') {
    return lowered;
  }
  return 'closed';
}

function parseDatetime(value) {
  if (!value) {
    return '';
  }
  const asDate = new Date(value);
  if (Number.isNaN(asDate.getTime())) {
    return '';
  }
  return asDate.toISOString();
}

async function importCsv(filePath) {
  const absolutePath = path.resolve(filePath || DEFAULT_FILE);
  const content = await fs.readFile(absolutePath, 'utf-8');
  const rows = parseCsv(content);
  const entries = toObject(rows);

  const sessions = new Map();

  entries.forEach((entry) => {
    const id = entry.sessionId || entry.id || generateId('session');
    const existing = sessions.get(id) || {
      id,
      settings: {
        hostName: entry.hostName || '',
        location: entry.location || '',
        datetime: parseDatetime(entry.datetime),
        expenses: safeNumber(entry.expenses),
        reportedFinal: safeNumber(entry.reportedFinal),
        currency: entry.currency || 'USD',
        sessionStatus: normalizeStatus(entry.status),
      },
      players: [],
      createdAt: parseDatetime(entry.createdAt) || parseDatetime(entry.datetime) || new Date().toISOString(),
      updatedAt: parseDatetime(entry.updatedAt) || parseDatetime(entry.datetime) || new Date().toISOString(),
    };

    const playerName = entry.playerName || entry.player || '';
    const playerId = entry.playerId || `${id}-${playerName.replace(/\s+/g, '-').toLowerCase()}`;
    if (playerName) {
      existing.players.push({
        id: playerId,
        name: playerName,
        buyins: safeNumber(entry.buyins),
        final: safeNumber(entry.final),
      });
    }

    sessions.set(id, existing);
  });

  for (const session of sessions.values()) {
    await createSession(session);
  }

  console.log(`Imported ${sessions.size} sessions from ${absolutePath}`);
}

const targetFile = process.argv[2] || DEFAULT_FILE;
importCsv(targetFile).catch((error) => {
  console.error('Failed to import historical sessions:', error);
  process.exitCode = 1;
});
