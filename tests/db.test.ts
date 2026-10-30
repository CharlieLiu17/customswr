import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { setDb, ensureSchema, db } from '../lib/db';
import { createPlayer, adjustMmr, createMatch, updateMatch, deleteMatch, getPlayers, getLines, resetBaselines } from '../lib/data';
import { relations, summarize, teamSynergy, teamAgainst, fillScore } from '../lib/stats';
import { ROLES } from '../lib/types';

const names = Array.from({ length: 10 }, (_, i) => `p${i}`);
const team = (ns: string[]) => ns.map((player, i) => ({ player, role: ROLES[i] }));
const game = (winner: 0 | 1, date = '2026-01-01') => ({ date, team0: team(names.slice(0, 5)), team1: team(names.slice(5)), winner });

beforeEach(async () => {
  setDb(createClient({ url: ':memory:' })); await ensureSchema();
  for (const n of names) await createPlayer({ name: n, start_mmr: 1200, playable_roles: [...ROLES] });
});
const mmr = async () => Object.fromEntries((await getPlayers()).map((p) => [p.name, p.mmr]));

describe('recording games', () => {
  it('a win/loss moves MMR ±15 and saves roles', async () => {
    await createMatch(game(0));
    const m = await mmr(); expect(m.p0).toBe(1215); expect(m.p9).toBe(1185);
    const lines = await getLines(); expect(lines).toHaveLength(10);
    expect(lines.find((l) => l.player === 'p3')!.role).toBe('Bottom');
  });
  it('rubber-bands over a streak', async () => {
    for (let i = 0; i < 6; i++) await createMatch(game(0)); // p0 wins 6 straight from baseline 1200
    const deltas = [15, 15, 15, 15, 14, 14]; // drift hits 60 after 4 wins -> gain shrinks to 14
    expect((await mmr()).p0).toBe(1200 + deltas.reduce((a, b) => a + b, 0));
  });
  it('flipping a past result recomputes everyone after it', async () => {
    const id1 = await createMatch(game(0)); await createMatch(game(0)); await createMatch(game(1));
    await updateMatch(id1, game(1));
    const m = await mmr(); // p0: L, W, L from 1200 (base 1200): 1185 -> 1200(drift-15 q=0 => +15) -> 1185
    expect(m.p0).toBe(1185); expect(m.p9).toBe(1215);
  });
  it('deleting a game rolls MMR back', async () => {
    await createMatch(game(0)); const id2 = await createMatch(game(0)); await deleteMatch(id2);
    expect((await mmr()).p0).toBe(1215); expect(await getLines()).toHaveLength(10);
  });
  it('validates input', async () => {
    await expect(createMatch({ ...game(0), team0: team(names.slice(0, 4)) })).rejects.toThrow(/5 players/);
    await expect(createMatch({ ...game(0), team1: team(names.slice(4, 9)) })).rejects.toThrow(/once/);
    const dup = game(0); dup.team0[1].role = 'Top'; await expect(createMatch(dup)).rejects.toThrow(/one player per role/);
  });
  it('new baseline only affects future games', async () => {
    await createMatch(game(0)); await resetBaselines(); await createMatch(game(0));
    expect((await mmr()).p0).toBe(1230); // second win is again +15 because drift is measured from 1215
  });
});

describe('manual MMR corrections', () => {
  it('survive later games and recomputes', async () => {
    const id1 = await createMatch(game(0));
    const p0 = (await getPlayers()).find((p) => p.name === 'p0')!;
    await adjustMmr(p0.id, 1000, 'reset');                       // set to 1000 after game 1
    expect((await mmr()).p0).toBe(1000);
    const id2 = await createMatch(game(0));                      // base is 1200 -> drift -200 -> q=-3 -> +18
    expect((await mmr()).p0).toBe(1018);
    await updateMatch(id1, game(1));                             // editing game 1 must not erase the correction
    expect((await mmr()).p0).toBe(1018);
    await deleteMatch(id2); expect((await mmr()).p0).toBe(1000);
  });
});

describe('stats from stored games', () => {
  it('summary, pairwise, against, synergy', async () => {
    await createMatch(game(0)); await createMatch(game(0)); await createMatch(game(1));
    const lines = await getLines(), s = summarize(lines), rel = relations(lines);
    expect(s.get('p0')).toMatchObject({ wins: 2, losses: 1 });
    expect(rel.with.get('p0')!.get('p1')).toEqual({ w: 2, l: 1 });
    expect(rel.against.get('p0')!.get('p5')).toEqual({ w: 2, l: 1 });
    expect(rel.with.get('p0')!.get('p5')).toBeUndefined();
    expect(teamSynergy(rel, names.slice(0, 5))).toBeCloseTo(2 / 3);
    expect(teamAgainst(rel, names.slice(0, 5), names.slice(5))).toBeCloseTo(2 / 3);
    expect(teamAgainst(rel, names.slice(5), names.slice(0, 5))).toBeCloseTo(1 / 3);
  });
  it('fill score formula', () => {
    expect(fillScore({ Top: 4, Jungle: 4, Mid: 4, Bottom: 4, Support: 4 })).toBeCloseTo(1);
    expect(fillScore({ Top: 10, Jungle: 0, Mid: 0, Bottom: 0, Support: 0 })).toBeCloseTo(0); // pure one-trick -> 0%
  });
});
