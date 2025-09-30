const http = require('http');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

async function ensureDataFile() {
  try {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    await fsp.access(SESSIONS_FILE);
  } catch (error) {
    await fsp.writeFile(SESSIONS_FILE, JSON.stringify([], null, 2));
  }
}

async function readSessions() {
  await ensureDataFile();
  const raw = await fsp.readFile(SESSIONS_FILE, 'utf-8');
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to parse sessions file. Resetting to empty array.', error);
    await fsp.writeFile(SESSIONS_FILE, JSON.stringify([], null, 2));
    return [];
  }
}

async function writeSessions(sessions) {
  await ensureDataFile();
  await fsp.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function generateId() {
  return `session-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function serveStaticFile(res, filePath) {
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function isApiRoute(urlPath) {
  return urlPath.startsWith('/api/');
}

async function handleApiRequest(req, res, url) {
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/sessions') {
    const sessions = await readSessions();
    sendJson(res, 200, { sessions });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/sessions') {
    try {
      const payload = await parseRequestBody(req);
      const sessions = await readSessions();
      const timestamp = new Date().toISOString();
      const session = {
        id: payload.id || generateId(),
        createdAt: timestamp,
        updatedAt: timestamp,
        settings: {
          hostName: '',
          location: '',
          datetime: '',
          expenses: '',
          reportedFinal: '',
          currency: 'USD',
          sessionStatus: 'open',
          ...(payload.settings || {}),
        },
        players: Array.isArray(payload.players) ? payload.players : [],
      };
      sessions.push(session);
      await writeSessions(sessions);
      sendJson(res, 201, session);
    } catch (error) {
      console.error('Failed to create session', error);
      sendJson(res, 400, { message: 'Invalid JSON payload' });
    }
    return;
  }

  const match = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (match) {
    const sessionId = decodeURIComponent(match[1]);
    const sessions = await readSessions();
    const index = sessions.findIndex((item) => item.id === sessionId);

    if (req.method === 'GET') {
      if (index === -1) {
        sendJson(res, 404, { message: 'Session not found' });
        return;
      }
      sendJson(res, 200, sessions[index]);
      return;
    }

    if (req.method === 'PUT') {
      if (index === -1) {
        sendJson(res, 404, { message: 'Session not found' });
        return;
      }

      try {
        const payload = await parseRequestBody(req);
        const existing = sessions[index];
        const updated = {
          ...existing,
          ...payload,
          id: existing.id,
          updatedAt: new Date().toISOString(),
          settings: {
            ...existing.settings,
            ...(payload.settings || {}),
          },
          players: Array.isArray(payload.players) ? payload.players : existing.players,
        };
        sessions[index] = updated;
        await writeSessions(sessions);
        sendJson(res, 200, updated);
      } catch (error) {
        console.error('Failed to update session', error);
        sendJson(res, 400, { message: 'Invalid JSON payload' });
      }
      return;
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ message: 'Method not allowed' }));
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (isApiRoute(url.pathname)) {
      await handleApiRequest(req, res, url);
      return;
    }

    let requestedPath = url.pathname;
    if (requestedPath === '/' || requestedPath === '') {
      requestedPath = '/index.html';
    }

    const absolutePath = path.join(ROOT_DIR, requestedPath);
    const normalizedPath = path.normalize(absolutePath);
    if (!normalizedPath.startsWith(ROOT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    serveStaticFile(res, normalizedPath);
  } catch (error) {
    console.error('Unexpected server error', error);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`Poker Face Tracker server running on http://localhost:${PORT}`);
});
