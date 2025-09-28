# Poker Night Tracker

A lightweight, client-side web app to coordinate poker nights end-to-end. Hosts can configure the session, invite players to register themselves, and keep tabs on table totals, expenses, and outcomes. All data stays in the browser via `localStorage` so every host can quickly resume where they left off.

## Features

- Slide-out settings menu with host controls for name, location, session date/time, preferred currency (USD, EUR, or ILS), reported final cash, and table expenses.
- Session status management so the administrator can open or close editing. Player inputs are locked and the add/remove buttons are disabled the moment a night is closed.
- Shareable player registration link (`?role=player`) that reveals a streamlined view where guests can add themselves and update their buy-ins/final cash while the session is open.
- Live summary showing total buy-ins, final cash, table delta (highlighted bright red when off), leftover cash after expenses, and win/loss counts.
- Data automatically persists in the same browser via `localStorage` with a one-click reset when you need to start fresh.

## Getting started

Open `index.html` in any modern browser, or serve the repo locally:

```bash
python -m http.server 8000
```

Then navigate to http://localhost:8000.
