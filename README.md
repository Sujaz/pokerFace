# Poker Night Tracker

A full-stack poker night companion that lets hosts coordinate sessions, track cash movement, and review historical performance.

## Features

- Slide-out settings drawer with host controls for name, location, date/time, preferred currency (USD, EUR, or ILS), reported totals, and table expenses.
- Session lifecycle management: administrators can open/close a night, and once closed, player inputs are locked until a fresh session begins.
- Shareable player registration mode (`?role=player`) so guests can enter their buy-ins and cash-out amounts while the event remains open.
- Persistent session archive stored on disk (`data/sessions.json`) so every night is saved for future reference.
- Historical scoreboard that surfaces the most profitable player and win leaders per session, by year, or across all time, complete with filterable tables.
- Real-time summary metrics: total buy-ins, total cash out, table delta (highlighted bright red when not balanced), expense totals, and cumulative wins/losses.

## Getting started

No external dependencies are required—the server is built on Node's core modules. Populate the sample data, then launch the tracker:

```bash
npm run seed   # creates data/sessions.json with 3 sessions and 5 active players
npm start
```

Then open http://localhost:3000 in your browser.

Sessions and player data are written to `data/sessions.json`. Each update is saved automatically while a session is open, and closing a session locks it into the archive so you can compare past results from the scoreboard. Re-run `npm run seed` at any time to restore the demo data.

## Running with Docker

You can also run the tracker in a container using the provided `Dockerfile`.

1. Build the image:

   ```bash
   docker build -t poker-night-tracker .
   ```

2. Launch the container and expose port 3000. Mount a local directory to persist session history between runs:

   ```bash
   docker run --rm -p 3000:3000 -v "$(pwd)/data:/app/data" poker-night-tracker
   ```

   On Windows PowerShell, use `${PWD}` instead of `$(pwd)` for the bind mount path.

With the container running, browse to http://localhost:3000 to access the app. All session data remains in your mounted `data` directory so historical results survive container restarts.

## Branching

All development now lives on the `main` branch. Previous working branches have been consolidated so you can pull directly from `main` to receive the latest tracker updates.
