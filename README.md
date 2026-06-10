# CrowdPlay — Leaderboard Edition

> A fork of [sachgaur/CrowdGame](https://github.com/sachgaur/CrowdGame) with a **global persistent leaderboard**, UI overhaul, and UX improvements.

---

## What Was Changed

### 1. Global Persistent Leaderboard (`🏆 New Feature`)

Every completed puzzle session is automatically recorded to a new `global_leaderboard` database table.
Scores persist across server restarts (using the same SQLite or PostgreSQL database the app already uses).

**New files:**
- `src/services/leaderboard.js` — DB layer: `ensureTable`, `recordGame`, `getTopScores`, `getPlayerBest`, `getGlobalStats`
- `src/routes/leaderboard.js` — REST API (`GET /api/leaderboard`, `/api/leaderboard/stats`, `/api/leaderboard/player`)
- `public/leaderboard.html` — Standalone leaderboard page with live search, stats banner, animated rows, and auto-refresh every 30s

**Modified files:**
- `src/services/db.js` — calls `ensureTable()` during `initSchema` bootstrap
- `src/socket/index.js` — records game results via `lb.recordGame()` on puzzle completion; stamps `room.startedAt` to track solve duration; passes `solveDurationSecs` in the `activity-complete` broadcast
- `server.js` — mounts `GET/DELETE /api/leaderboard` router; adds `GET /leaderboard` page route
- `public/screen.js` — uses server-provided `solveDurationSecs`; fetches global rank after completion; adds near-complete progress bar glow
- `public/screen.html` — completion screen shows global rank + "View Global Leaderboard" button
- `public/mobile.html` — complete screen includes "Global Leaderboard" link

### 2. UI / UX Overhaul (`🎨 Improved`)

| Page | Change |
|------|--------|
| **Landing page** (`index.html`) | Full redesign — Orbitron title font, gradient accent bar, better button hierarchy, leaderboard nav button, animated grid background |
| **Admin header** | Leaderboard quick-link, version bump to v2.0 |
| **Big screen** — gameplay HUD | Progress bar pulses with a cyan glow when puzzle is ≥85% complete |
| **Big screen** — completion screen | Shows formatted solve time (e.g. `1m 42s`), all-time rank badge, leaderboard link button |
| **Mobile** — completion screen | "Global Leaderboard" link button |
| **Lobby cards** | Subtle lift-on-hover transform effect |
| `screen.css` | New `.btn-leaderboard`, `.near-complete` glow animation, hover transitions |

---

## Setup & Running

### Prerequisites

- **Node.js** ≥ 14
- **npm** ≥ 7
- Optional: PostgreSQL (falls back to SQLite automatically)

### 1. Clone the fork

```bash
git clone https://github.com/<your-username>/CrowdGame.git
cd CrowdGame
```

### 2. Install dependencies

```bash
npm install
```

> If you hit a SQLite rebuild issue in certain environments (e.g. mismatched native binaries), run:
> ```bash
> npm rebuild sqlite3
> # or
> npm install sqlite3 --build-from-source
> ```

### 3. Environment (optional)

Create a `.env` file or set environment variables:

```env
PORT=3000                  # default: 3000
ADMIN_PASSWORD=mysecret    # default: admin123
JWT_SECRET=changeme        # default: crowdplay-super-secret-key-change-in-prod

# Optional: use PostgreSQL instead of SQLite
DATABASE_URL=postgres://user:pass@host:5432/crowdplay
```

### 4. Run

```bash
npm start
# or for development
npm run dev
```

The server starts on **HTTPS** in development (self-signed cert) — required for DeviceOrientation API on mobile.

### 5. Access

| URL | Description |
|-----|-------------|
| `https://localhost:3000/` | Landing page |
| `https://localhost:3000/admin` | Admin panel (password: `admin123`) |
| `https://localhost:3000/screen/DEMO` | Big screen display |
| `https://localhost:3000/leaderboard` | **Global leaderboard** (new) |

> Mobile browsers will show a certificate warning for the self-signed cert. Tap **Advanced → Proceed** to continue.

---

## Leaderboard API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/leaderboard?limit=20` | None | Top N all-time scores |
| `GET` | `/api/leaderboard/stats` | None | Aggregate stats (total solvers, fastest solve) |
| `GET` | `/api/leaderboard/player?name=Maverick` | None | Personal best for a player |
| `DELETE` | `/api/leaderboard/reset` | Admin JWT | Wipe all leaderboard records |

---

## Assumptions & Known Limitations

- **Solve duration** is computed server-side from when the admin clicks "Start Activity" to when the last piece is placed. If the admin panel was pre-opened or the clock drifts, the duration may be slightly off.
- **Player names are not deduplicated** — "Maverick" in room A and "Maverick" in room B appear as separate entries. This is intentional; names are per-session display names, not accounts.
- **SQLite** is used by default and stores all data in `crowdplay.sqlite` next to `server.js`. For production deployments, set `DATABASE_URL` to a PostgreSQL connection string.
- The leaderboard auto-refreshes every **30 seconds** while the browser tab is visible.
- The `DELETE /api/leaderboard/reset` endpoint requires a valid admin JWT (same token used by the admin panel).

---

## Screenshots

> See `/public/leaderboard.html` — animated neon synthwave leaderboard with medal badges (🥇🥈🥉), live search filter, stats banner, and CRT overlay.

---

## Tech Stack

- **Backend:** Node.js, Express, Socket.IO, Knex (SQLite/PostgreSQL)
- **Frontend:** Vanilla JS, CSS custom properties, Web Audio API
- **Fonts:** Orbitron, Outfit, Share Tech Mono (Google Fonts)
