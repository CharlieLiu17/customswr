# Customs WR

A standalone replacement for the **Customs WR's** Google Sheet + Apps Script. Same matchmaking, same MMR rules, same stats — but games are logged in two taps and everything is stored in a database instead of a 300-column grid.

## Run it locally (2 minutes)

```bash
npm install
cp .env.example .env.local      # then set ADMIN_PASSWORD
npm run dev                     # http://localhost:3000
```

`data/customs.db` ships pre-loaded with your 46 players and 289 games, so it works immediately.
Anyone can **view**; logging games and managing players needs the admin password (Admin page).
Local dev without `ADMIN_PASSWORD` set uses the password `admin`; production refuses to log anyone in until you set one.

## What replaced what

| Sheet | App |
|---|---|
| Records tab (wide W/L grid) | **Log game** page (pick 10 players, tap the winner) and **Games** history (edit/delete) |
| Matchmaking tab + `Code.gs` | **Matchmaking** page — pick 10, see ranked splits, tap *Blue won* / *Red won* to save with roles |
| MMR rows under Records | Computed on save with your exact formula; per-player chart on each profile |
| Roles / Playable Roles / WR by Roles / fill score | Player profile + Records (Fill column) |
| Pairwise WRs / WR Against / Games Played With / Kryptonites | **Matrix** (with / against), **Head-to-head**, best/worst teammates & opponents on profiles |
| `WR.gs` average synergy / against | Shown for each matchmaking option |
| "Adding players is a lot of work" | **Admin → Add player** (name, starting MMR, roles) — nothing else to touch |

## How it works

- **MMR:** `W: +15 − trunc(drift/60)`, `L: −(15 + trunc(drift/60))`, where drift = current MMR − the player's baseline (the sheet's `$IL56`). *Admin → Reset baselines* is the sheet's "New Baseline". Editing or deleting a past game recalculates everyone's MMR after it. Manual corrections (*Admin → Set MMR*) are kept in history.
- **Matchmaking:** instead of the randomised swap/hill-climb, it checks all 126 distinct splits of the 10 players, drops any with two same-role one-tricks or a team that can't fill all 5 roles (using each player's playable roles), and ranks the rest by MMR gap. The result is deterministic and provably optimal. Among valid role assignments it prefers the roles players have actually played most. One-tricks are set per player (Admin page), replacing the hard-coded list.
- **Estimate:** each team's synergy (avg teammate-pair WR) and against (avg WR vs the other 5), averaged — same as `WR.gs`.
- **Fill score:** `1 − 2.5 × σ(role shares)`.

## Tests

`npm test` — 20 tests, including: every player's Wins/Losses equals the sheet, the MMR formula reproduces >99% of the sheet's recorded MMRs, and the matchmaking engine is checked against an independent brute force on random pools.

## Deploy

SQLite is a file, so it needs a persistent disk. Two options:

**A. Vercel + Turso (free tiers)**
1. Create a database at turso.tech; copy its URL and auth token.
2. Load your data once: `DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… npm run import`
3. Import the repo into Vercel and set `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ADMIN_PASSWORD`, `SESSION_SECRET`.

**B. Any VPS / Railway / Fly with a volume**
`npm run build && ADMIN_PASSWORD=… SESSION_SECRET=… npm start` (keeps using `data/customs.db`; put it on the volume).

## Re-importing from the sheet

`python3 scripts/extract.py data/records.csv data/seed.json && npm run import -- --force` rebuilds the local DB from a fresh CSV export of the Records tab (**this wipes the local DB**).

## Known data notes (from the import)

- 23 of 289 games in the sheet don't have exactly 5 winners + 5 losers recorded; they're imported as-is and flagged **incomplete** (so W/L totals still match the sheet). Open one in Games → Edit to complete it.
- The sheet's MMR cells contain ~28 small hand edits; those are preserved as history. Only if you edit an *old* game will later MMRs be recomputed by the formula, which can shift those by a point or so.
- 4 players (aakash12, CurryMonster821, Ziji3, Aditya) had MMR corrections after their last game — imported as manual corrections.
- Sheet names `CharlezardPotato`→`Charlezard`, `his ride`→`Abdalla`, `Khango`→`Beepo` (matched to the MMR section). Teams in old games aren't in the sheet, so winners/losers are treated as the two teams — fine for every stat.
- Bones has no games or role data; he's given all five roles so he can be matchmade.
