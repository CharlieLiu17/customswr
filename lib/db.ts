import { createClient, type Client } from '@libsql/client';

let _db: Client | null = null;
export function db(): Client {
  if (!_db) _db = createClient({ url: process.env.DATABASE_URL ?? 'file:data/customs.db', authToken: process.env.DATABASE_AUTH_TOKEN });
  return _db;
}
export function setDb(c: Client) { _db = c; }

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  start_mmr REAL NOT NULL,
  baseline_mmr REAL NOT NULL,
  mmr REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  one_trick_role TEXT
);
CREATE TABLE IF NOT EXISTS playable_roles (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  PRIMARY KEY (player_id, role)
);
CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seq INTEGER NOT NULL UNIQUE,
  played_on TEXT NOT NULL,
  external_id TEXT,
  incomplete INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS match_players (
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id),
  team INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('W','L')),
  role TEXT,
  base_mmr REAL,
  mmr_after REAL,
  PRIMARY KEY (match_id, player_id)
);
CREATE TABLE IF NOT EXISTS mmr_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  after_seq INTEGER NOT NULL,
  mmr REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mp_player ON match_players(player_id);
CREATE TABLE IF NOT EXISTS player_igns (
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  ign TEXT NOT NULL,
  PRIMARY KEY (player_id, ign)
);
CREATE INDEX IF NOT EXISTS idx_igns_ign ON player_igns(ign);
`;
export async function ensureSchema() { await db().executeMultiple(SCHEMA); }
