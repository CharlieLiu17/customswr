import { db } from './db';
import type { GameLine, PlayerRow, Result, Role } from './types';
import { applyResult } from './mmr';

export async function getPlayers(): Promise<PlayerRow[]> {
  const [p, r] = await Promise.all([
    db().execute('SELECT * FROM players ORDER BY name COLLATE NOCASE'),
    db().execute('SELECT player_id, role FROM playable_roles'),
  ]);
  const roles = new Map<number, Role[]>();
  for (const x of r.rows) { const id = Number(x.player_id); (roles.get(id) ?? roles.set(id, []).get(id)!).push(String(x.role) as Role); }
  return p.rows.map((x) => ({
    id: Number(x.id), name: String(x.name), start_mmr: Number(x.start_mmr), baseline_mmr: Number(x.baseline_mmr), mmr: Number(x.mmr),
    active: Number(x.active) === 1, one_trick_role: (x.one_trick_role as Role | null) ?? null, playable_roles: roles.get(Number(x.id)) ?? [],
  }));
}

export async function getLines(): Promise<GameLine[]> {
  const r = await db().execute(`
    SELECT m.id AS match_id, m.seq, m.played_on AS date, m.incomplete, p.id AS player_id, p.name AS player,
           mp.team, mp.result, mp.role, mp.mmr_after
    FROM match_players mp JOIN matches m ON m.id = mp.match_id JOIN players p ON p.id = mp.player_id
    ORDER BY m.seq, mp.team, p.name`);
  return r.rows.map((x) => ({
    match_id: Number(x.match_id), seq: Number(x.seq), date: String(x.date), incomplete: Number(x.incomplete) === 1,
    player_id: Number(x.player_id), player: String(x.player), team: Number(x.team) as 0 | 1,
    result: String(x.result) as Result, role: (x.role as Role | null) ?? null, mmr_after: x.mmr_after == null ? null : Number(x.mmr_after),
  }));
}

export interface EntryInput { player: string; role: Role | null }
export interface MatchInput { date: string; team0: EntryInput[]; team1: EntryInput[]; winner: 0 | 1; notes?: string | null }

function validate(inp: MatchInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inp.date)) throw new Error('Date must be YYYY-MM-DD');
  if (inp.team0.length !== 5 || inp.team1.length !== 5) throw new Error('Each team needs exactly 5 players');
  const names = [...inp.team0, ...inp.team1].map((e) => e.player);
  if (new Set(names).size !== 10) throw new Error('A player can only appear once per game');
  for (const e of [...inp.team0, ...inp.team1]) if (!e.role) throw new Error(`Pick a role for ${e.player}`);
  for (const t of [inp.team0, inp.team1]) if (new Set(t.map((e) => e.role)).size !== 5) throw new Error('Each team needs one player per role');
}

async function playerIds(names: string[]): Promise<Map<string, number>> {
  const r = await db().execute({ sql: `SELECT id, name FROM players WHERE name IN (${names.map(() => '?').join(',')})`, args: names });
  const m = new Map(r.rows.map((x) => [String(x.name), Number(x.id)]));
  for (const n of names) if (!m.has(n)) throw new Error(`Unknown player: ${n}`);
  return m;
}

/**
 * Re-derive mmr_after for the given players from game `fromSeq` onward, and refresh players.mmr.
 * Manual corrections (mmr_adjustments, "after game N the player's MMR was set to X") are respected.
 */
export async function recomputeMmr(playerIds_: number[], fromSeq: number) {
  for (const pid of playerIds_) {
    const p = (await db().execute({ sql: 'SELECT start_mmr FROM players WHERE id=?', args: [pid] })).rows[0];
    const prev = (await db().execute({
      sql: `SELECT m.seq, mp.mmr_after FROM match_players mp JOIN matches m ON m.id=mp.match_id
            WHERE mp.player_id=? AND m.seq<? ORDER BY m.seq DESC LIMIT 1`, args: [pid, fromSeq] })).rows[0];
    let cur = prev?.mmr_after != null ? Number(prev.mmr_after) : Number(p.start_mmr);
    const prevSeq = prev ? Number(prev.seq) : 0;
    const games = (await db().execute({
      sql: `SELECT m.seq, mp.match_id, mp.result, mp.base_mmr FROM match_players mp JOIN matches m ON m.id=mp.match_id
            WHERE mp.player_id=? AND m.seq>=? ORDER BY m.seq`, args: [pid, fromSeq] })).rows;
    const adjs = (await db().execute({
      sql: 'SELECT after_seq, mmr FROM mmr_adjustments WHERE player_id=? AND after_seq>=? ORDER BY after_seq, id', args: [pid, prevSeq] })).rows;
    type Ev = { key: number; adj?: number; game?: (typeof games)[number] };
    const events: Ev[] = [
      ...adjs.map((a) => ({ key: Number(a.after_seq) + 0.5, adj: Number(a.mmr) })),
      ...games.map((g) => ({ key: Number(g.seq), game: g })),
    ].sort((x, y) => x.key - y.key);
    for (const ev of events) {
      if (ev.adj !== undefined) { cur = ev.adj; continue; }
      const g = ev.game!;
      cur = applyResult(String(g.result) as Result, cur, g.base_mmr == null ? cur : Number(g.base_mmr));
      await db().execute({ sql: 'UPDATE match_players SET mmr_after=? WHERE match_id=? AND player_id=?', args: [cur, g.match_id as number, pid] });
    }
    await db().execute({ sql: 'UPDATE players SET mmr=? WHERE id=?', args: [cur, pid] });
  }
}

/** Manually set a player's MMR from now on (e.g. re-estimating a newcomer). */
export async function adjustMmr(playerId: number, mmr: number, note?: string) {
  const seq = Number((await db().execute('SELECT COALESCE(MAX(seq),0) AS s FROM matches')).rows[0].s);
  await db().execute({ sql: 'INSERT INTO mmr_adjustments (player_id, after_seq, mmr, note) VALUES (?,?,?,?)', args: [playerId, seq, mmr, note ?? null] });
  await db().execute({ sql: 'UPDATE players SET mmr=? WHERE id=?', args: [mmr, playerId] });
}

async function writeEntries(matchId: number, inp: MatchInput, ids: Map<string, number>) {
  for (const team of [0, 1] as const) {
    for (const e of team === 0 ? inp.team0 : inp.team1) {
      const pid = ids.get(e.player)!;
      const base = Number((await db().execute({ sql: 'SELECT baseline_mmr FROM players WHERE id=?', args: [pid] })).rows[0].baseline_mmr);
      await db().execute({
        sql: 'INSERT INTO match_players (match_id, player_id, team, result, role, base_mmr) VALUES (?,?,?,?,?,?)',
        args: [matchId, pid, team, team === inp.winner ? 'W' : 'L', e.role, base] });
    }
  }
}

export async function createMatch(inp: MatchInput): Promise<number> {
  validate(inp);
  const ids = await playerIds([...inp.team0, ...inp.team1].map((e) => e.player));
  const seq = Number((await db().execute('SELECT COALESCE(MAX(seq),0)+1 AS s FROM matches')).rows[0].s);
  const r = await db().execute({ sql: 'INSERT INTO matches (seq, played_on, notes) VALUES (?,?,?)', args: [seq, inp.date, inp.notes ?? null] });
  const id = Number(r.lastInsertRowid);
  await writeEntries(id, inp, ids);
  await recomputeMmr([...ids.values()], seq);
  return id;
}

export async function updateMatch(id: number, inp: MatchInput) {
  validate(inp);
  const m = (await db().execute({ sql: 'SELECT seq FROM matches WHERE id=?', args: [id] })).rows[0];
  if (!m) throw new Error('Game not found');
  const seq = Number(m.seq);
  const old = (await db().execute({ sql: 'SELECT player_id FROM match_players WHERE match_id=?', args: [id] })).rows.map((x) => Number(x.player_id));
  const ids = await playerIds([...inp.team0, ...inp.team1].map((e) => e.player));
  await db().execute({ sql: 'DELETE FROM match_players WHERE match_id=?', args: [id] });
  await db().execute({ sql: 'UPDATE matches SET played_on=?, notes=?, incomplete=0 WHERE id=?', args: [inp.date, inp.notes ?? null, id] });
  await writeEntries(id, inp, ids);
  await recomputeMmr([...new Set([...old, ...ids.values()])], seq);
}

export async function deleteMatch(id: number) {
  const m = (await db().execute({ sql: 'SELECT seq FROM matches WHERE id=?', args: [id] })).rows[0];
  if (!m) throw new Error('Game not found');
  const old = (await db().execute({ sql: 'SELECT player_id FROM match_players WHERE match_id=?', args: [id] })).rows.map((x) => Number(x.player_id));
  await db().execute({ sql: 'DELETE FROM match_players WHERE match_id=?', args: [id] });
  await db().execute({ sql: 'DELETE FROM matches WHERE id=?', args: [id] });
  await recomputeMmr(old, Number(m.seq));
}

export interface NewPlayer { name: string; start_mmr: number; playable_roles: Role[]; one_trick_role?: Role | null }
export async function createPlayer(p: NewPlayer) {
  const name = p.name.trim();
  if (!name) throw new Error('Name required');
  if (!p.playable_roles.length) throw new Error('Pick at least one playable role');
  const r = await db().execute({ sql: 'INSERT INTO players (name,start_mmr,baseline_mmr,mmr,one_trick_role) VALUES (?,?,?,?,?)',
    args: [name, p.start_mmr, p.start_mmr, p.start_mmr, p.one_trick_role ?? null] });
  for (const role of p.playable_roles) await db().execute({ sql: 'INSERT INTO playable_roles VALUES (?,?)', args: [Number(r.lastInsertRowid), role] });
}
export async function updatePlayer(id: number, p: { playable_roles?: Role[]; one_trick_role?: Role | null; active?: boolean; start_mmr?: number }) {
  if (p.one_trick_role !== undefined) await db().execute({ sql: 'UPDATE players SET one_trick_role=? WHERE id=?', args: [p.one_trick_role, id] });
  if (p.active !== undefined) await db().execute({ sql: 'UPDATE players SET active=? WHERE id=?', args: [p.active ? 1 : 0, id] });
  if (p.playable_roles) {
    await db().execute({ sql: 'DELETE FROM playable_roles WHERE player_id=?', args: [id] });
    for (const role of p.playable_roles) await db().execute({ sql: 'INSERT INTO playable_roles VALUES (?,?)', args: [id, role] });
  }
  if (p.start_mmr !== undefined) {
    await db().execute({ sql: 'UPDATE players SET start_mmr=? WHERE id=?', args: [p.start_mmr, id] });
    await recomputeMmr([id], 0);
  }
}
/** Sheet's "New Baseline": everyone's rubber-band anchor becomes their current MMR (applies to future games). */
export async function resetBaselines() { await db().execute('UPDATE players SET baseline_mmr = mmr'); }
