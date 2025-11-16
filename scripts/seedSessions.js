const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

/**
 * Creates a player entry for the seed data file.
 * @param {string} id - Stable identifier for the player.
 * @param {string} name - Display name of the player.
 * @param {number} buyins - Total buy-ins purchased.
 * @param {number} final - Final chip/cash amount.
 * @returns {{id:string,name:string,buyins:number,final:number}} Player object.
 */
function makePlayer(id, name, buyins, final) {
  return {
    id,
    name,
    buyins,
    final,
  };
}

/**
 * Builds a session object using simple shorthand parameters.
 * @param {Object} config - Properties describing the session.
 * @param {string} config.id - Session identifier.
 * @param {string} config.createdAt - ISO timestamp for creation.
 * @param {string} config.updatedAt - ISO timestamp for last update.
 * @param {string} config.hostName - Host name running the game.
 * @param {string} config.location - Location of the table.
 * @param {string} config.datetime - ISO timestamp of the event.
 * @param {number} config.expenses - Table expenses for the night.
 * @param {number} config.reportedFinal - Reported final cash total.
 * @param {string} config.currency - Currency code (USD/EUR/ILS).
 * @param {string} config.status - Session status flag.
 * @param {Array} config.players - Players participating in the session.
 * @returns {Object} Normalized session payload.
 */
function sessionTemplate({
  id,
  createdAt,
  updatedAt,
  hostName,
  location,
  datetime,
  expenses,
  reportedFinal,
  currency,
  status,
  players,
}) {
  return {
    id,
    createdAt,
    updatedAt,
    settings: {
      hostName,
      location,
      datetime,
      expenses,
      reportedFinal,
      currency,
      sessionStatus: status,
    },
    players,
  };
}

/**
 * Seeds the local JSON file with three representative sessions.
 * @returns {Promise<void>} Resolves once the data has been written.
 */
async function seed() {
  await fs.mkdir(DATA_DIR, { recursive: true });

  const now = new Date();
  const isoNow = now.toISOString();
  const sessions = [
    sessionTemplate({
      id: 'session-2025-main',
      createdAt: isoNow,
      updatedAt: isoNow,
      hostName: 'Jamie Rivera',
      location: 'Skyline Loft',
      datetime: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0).toISOString(),
      expenses: 150,
      reportedFinal: 2800,
      currency: 'USD',
      status: 'open',
      players: [
        makePlayer('player-alex', 'Alex Morgan', 400, 525),
        makePlayer('player-bree', 'Bree Chen', 300, 180),
        makePlayer('player-cam', 'Cam Patel', 250, 420),
        makePlayer('player-dev', 'Devon Price', 500, 760),
        makePlayer('player-eden', 'Eden Solis', 350, 290),
      ],
    }),
    sessionTemplate({
      id: 'session-2024-holiday',
      createdAt: '2024-12-20T02:15:00.000Z',
      updatedAt: '2024-12-20T06:15:00.000Z',
      hostName: 'Jamie Rivera',
      location: 'Mountain Retreat',
      datetime: '2024-12-19T20:30:00.000Z',
      expenses: 120,
      reportedFinal: 2400,
      currency: 'EUR',
      status: 'closed',
      players: [
        makePlayer('player-alex-2024', 'Alex Morgan', 450, 610),
        makePlayer('player-bree-2024', 'Bree Chen', 300, 250),
        makePlayer('player-fern-2024', 'Fernando Ortiz', 280, 360),
        makePlayer('player-ida-2024', 'Ida Novak', 320, 260),
      ],
    }),
    sessionTemplate({
      id: 'session-2023-spring',
      createdAt: '2023-04-10T01:00:00.000Z',
      updatedAt: '2023-04-10T04:45:00.000Z',
      hostName: 'Jamie Rivera',
      location: 'Riverfront Condo',
      datetime: '2023-04-09T19:45:00.000Z',
      expenses: 95,
      reportedFinal: 2100,
      currency: 'USD',
      status: 'closed',
      players: [
        makePlayer('player-cam-2023', 'Cam Patel', 260, 480),
        makePlayer('player-dev-2023', 'Devon Price', 420, 340),
        makePlayer('player-fern-2023', 'Fernando Ortiz', 200, 260),
        makePlayer('player-gia-2023', 'Gia Walters', 280, 320),
      ],
    }),
  ];

  await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  console.log(`Seeded ${sessions.length} sessions with ${sessions[0].players.length} active players.`);
}

seed().catch((error) => {
  console.error('Failed to seed sessions file:', error);
  process.exitCode = 1;
});
