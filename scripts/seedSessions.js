const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function makePlayer(id, name, buyins, final) {
  return {
    id,
    name,
    buyins,
    final,
  };
}

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
