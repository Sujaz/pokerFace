const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { loadEnv } = require('./loadEnv');
const db = require('./db');

loadEnv();

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const databaseReady = db.ensureDatabase().catch((error) => {
  console.error('Database initialization failed:', error);
  throw error;
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

/**
 * Sends a JSON response with the supplied status code and payload.
 * @param {http.ServerResponse} res - Response object to write to.
 * @param {number} statusCode - HTTP status code for the response.
 * @param {Object} payload - Serializable data to send.
 * @returns {void}
 */
function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

/**
 * Consumes and parses a JSON request body.
 * @param {http.IncomingMessage} req - Incoming HTTP request.
 * @returns {Promise<Object>} Parsed JSON payload.
 */
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

/**
 * Streams a static asset from disk to the requester.
 * @param {http.ServerResponse} res - Response object to stream to.
 * @param {string} filePath - Absolute path to the file to serve.
 * @returns {void}
 */
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

/**
 * Determines whether the request path targets the JSON API.
 * @param {string} urlPath - Pathname portion of the request URL.
 * @returns {boolean} True when the path is an API endpoint.
 */
function isApiRoute(urlPath) {
  return urlPath.startsWith('/api/');
}

/**
 * Routes API requests for session CRUD operations.
 * @param {http.IncomingMessage} req - Client request.
 * @param {http.ServerResponse} res - Response to populate.
 * @param {URL} url - Parsed request URL.
 * @returns {Promise<void>} Resolves after the request is handled.
 */
async function handleApiRequest(req, res, url) {
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/api/sessions') {
    try {
      const sessions = await db.getSessions();
      sendJson(res, 200, { sessions });
    } catch (error) {
      console.error('Failed to fetch sessions', error);
      sendJson(res, 500, { message: 'Unable to read sessions from the database' });
    }
    return;
  }

  if (req.method === 'POST' && pathname === '/api/sessions') {
    try {
      const payload = await parseRequestBody(req);
      const session = await db.createSession(payload);
      sendJson(res, 201, session);
    } catch (error) {
      console.error('Failed to create session', error);
      sendJson(res, 400, { message: 'Unable to create session' });
    }
    return;
  }

  const match = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (match) {
    const sessionId = decodeURIComponent(match[1]);

    if (req.method === 'GET') {
      try {
        const session = await db.getSessionById(sessionId);
        if (!session) {
          sendJson(res, 404, { message: 'Session not found' });
          return;
        }
        sendJson(res, 200, session);
      } catch (error) {
        console.error('Failed to load session', error);
        sendJson(res, 500, { message: 'Unable to read session from the database' });
      }
      return;
    }

    if (req.method === 'PUT') {
      try {
        const payload = await parseRequestBody(req);
        const updated = await db.updateSession(sessionId, payload);
        if (!updated) {
          sendJson(res, 404, { message: 'Session not found' });
          return;
        }
        sendJson(res, 200, updated);
      } catch (error) {
        console.error('Failed to update session', error);
        sendJson(res, 400, { message: 'Unable to update session' });
      }
      return;
    }
  }

  res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ message: 'Method not allowed' }));
}

/**
 * Primary HTTP request handler supporting API and static file serving.
 * @param {http.IncomingMessage} req - Request from the client.
 * @param {http.ServerResponse} res - Response object for the reply.
 * @returns {Promise<void>} Resolves when the response is sent.
 */
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (isApiRoute(url.pathname)) {
      await databaseReady;
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
