import { readFileSync, existsSync, rmSync } from 'node:fs';
import { db, ensureSchema } from '../lib/db';

const seed = JSON.parse(readFileSync(new URL('../data/seed.json', import.meta.url), 'utf8'));
const url = process.env.DATABASE_URL ?? 'file:data/customs.db';
if (!process.argv.includes('--force') && existsSync('data/customs.db') && url.startsWith('file:')) {
  console.error('data/customs.db already exists. Re-run with --force to wipe and re-import.'); process.exit(1);
}
if (url.startsWith('file:') && existsSync('data/customs.db')) rmSync('data/customs.db');

await ensureSchema();
const ids = new Map<string, number>();
const oneTrick = new Map<string, string>();
for (const [role, names] of Object.entries(seed.one_tricks as Record<string, string[]>)) for (const n of names) oneTrick.set(n, role);

for (const p of seed.players) {
  const r = await db().execute({ sql: 'INSERT INTO players (name,start_mmr,baseline_mmr,mmr,active,one_trick_role) VALUES (?,?,?,?,?,?)',
    args: [p.name, p.start_mmr, p.baseline_mmr, p.current_mmr, 1, oneTrick.get(p.name) ?? null] });
  ids.set(p.name, Number(r.lastInsertRowid));
  for (const role of p.playable_roles) await db().execute({ sql: 'INSERT INTO playable_roles VALUES (?,?)', args: [ids.get(p.name)!, role] });
}
// Bones has no games or role info in the sheet: allow all roles so he can be matchmade
const bones = ids.get('Bones');
if (bones) for (const role of ['Top', 'Jungle', 'Mid', 'Bottom', 'Support']) await db().execute({ sql: 'INSERT OR IGNORE INTO playable_roles VALUES (?,?)', args: [bones, role] });

const stmts = [];
for (const m of seed.matches) {
  stmts.push({ sql: 'INSERT INTO matches (seq, played_on, external_id, incomplete) VALUES (?,?,?,?)', args: [m.seq, m.date, m.external_id, m.incomplete ? 1 : 0] });
}
await db().batch(stmts, 'write');
const mid = new Map((await db().execute('SELECT id, seq FROM matches')).rows.map((r) => [Number(r.seq), Number(r.id)]));
const mpStmts = [];
for (const m of seed.matches) {
  const winners = m.entries.filter((e: any) => e.result === 'W').length >= m.entries.length / 2;
  for (const e of m.entries) {
    // team 0 = the side that won (sheet only records W/L; teams are implied by the result)
    mpStmts.push({ sql: 'INSERT INTO match_players (match_id, player_id, team, result, role, base_mmr, mmr_after) VALUES (?,?,?,?,?,?,?)',
      args: [mid.get(m.seq)!, ids.get(e.player)!, e.result === 'W' ? 0 : 1, e.result, e.role, e.base_mmr, e.mmr_after] });
  }
}
await db().batch(mpStmts, 'write');
// manual MMR corrections the sheet made after a player's last game (current sheet value != last game result)
let adj = 0;
for (const p of seed.players) {
  const last = [...seed.matches].reverse().find((m: any) => m.entries.some((e: any) => e.player === p.name));
  const lastMmr = last?.entries.find((e: any) => e.player === p.name).mmr_after;
  if (lastMmr !== undefined && lastMmr !== p.current_mmr) {
    await db().execute({ sql: 'INSERT INTO mmr_adjustments (player_id, after_seq, mmr, note) VALUES (?,?,?,?)', args: [ids.get(p.name)!, last.seq, p.current_mmr, 'imported from sheet'] }); adj++;
  }
}
console.log(`Imported ${seed.players.length} players, ${seed.matches.length} games, ${mpStmts.length} player-lines, ${adj} manual MMR corrections.`);
