import { describe, it, expect } from 'vitest';
import { findSplits, assignRoles, hasOneTrickClash, type MMPlayer } from '../lib/matchmaking';
import { ROLES } from '../lib/types';

function rng(seed: number) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32); }
function randomPool(r: () => number): MMPlayer[] {
  return Array.from({ length: 10 }, (_, i) => {
    const playable = ROLES.filter(() => r() < 0.6); if (!playable.length) playable.push(ROLES[Math.floor(r() * 5)]);
    return { name: `P${i}`, mmr: 900 + Math.floor(r() * 700), playable: [...playable], oneTrick: playable.length === 1 && r() < 0.7 ? playable[0] : null };
  });
}
function combos(n: number, k: number): number[][] { const out: number[][] = []; const rec = (s: number, c: number[]) => { if (c.length === k) { out.push(c); return; } for (let i = s; i < n; i++) rec(i + 1, [...c, i]); }; rec(0, []); return out; }

describe('findSplits', () => {
  it('finds the true optimum: matches an independent brute force over all C(10,5) splits', () => {
    const r = rng(42);
    let tested = 0;
    for (let t = 0; t < 60; t++) {
      const pool = randomPool(r);
      let best = Infinity;
      for (const c of combos(10, 5)) {
        const a = c.map((i) => pool[i]), b = pool.filter((_, i) => !c.includes(i));
        if (hasOneTrickClash(a) || hasOneTrickClash(b) || !assignRoles(a) || !assignRoles(b)) continue;
        best = Math.min(best, Math.abs(a.reduce((s, p) => s + p.mmr, 0) - b.reduce((s, p) => s + p.mmr, 0)));
      }
      const res = findSplits(pool);
      if (best === Infinity) { expect(res).toHaveLength(0); continue; }
      expect(res[0].delta).toBe(best); tested++;
    }
    expect(tested).toBeGreaterThan(20);
  });
  it('every result obeys the role + one-trick rules and covers all 10 players once', () => {
    const r = rng(7);
    for (let t = 0; t < 30; t++) {
      const pool = randomPool(r); const byName = new Map(pool.map((p) => [p.name, p]));
      for (const s of findSplits(pool).slice(0, 10)) {
        const names = [...s.a.players, ...s.b.players].map((p) => p.name);
        expect(new Set(names).size).toBe(10);
        for (const team of [s.a, s.b]) {
          expect(team.players.map((p) => p.role).sort()).toEqual([...ROLES].sort());
          for (const p of team.players) expect(byName.get(p.name)!.playable).toContain(p.role);
          expect(hasOneTrickClash(team.players.map((p) => byName.get(p.name)!))).toBe(false);
        }
      }
    }
  });
  it('is sorted by delta and rejects bad input', () => {
    const pool = randomPool(rng(1)).map((p) => ({ ...p, playable: [...ROLES], oneTrick: null }));
    const res = findSplits(pool); expect(res.length).toBeLessThanOrEqual(126);
    for (let i = 1; i < res.length; i++) expect(res[i].delta).toBeGreaterThanOrEqual(res[i - 1].delta);
    expect(() => findSplits(pool.slice(0, 9))).toThrow();
  });
  it('keeps duos on the same team and still returns the best remaining split', () => {
    const r = rng(99);
    for (let t = 0; t < 30; t++) {
      const pool = randomPool(r).map((p) => ({ ...p, playable: [...ROLES], oneTrick: null }));
      const duos: [string, string][] = [['P1', 'P6'], ['P3', 'P0']];
      const res = findSplits(pool, duos);
      expect(res.length).toBeGreaterThan(0);
      for (const s of res) {
        const a = new Set(s.a.players.map((p) => p.name));
        for (const [x, y] of duos) expect(a.has(x)).toBe(a.has(y));
      }
      const unconstrained = findSplits(pool).filter((s) => { const a = new Set(s.a.players.map((p) => p.name)); return duos.every(([x, y]) => a.has(x) === a.has(y)); });
      expect(res[0].delta).toBe(unconstrained[0].delta);
    }
  });
  it('rejects invalid duos', () => {
    const pool = randomPool(rng(3));
    expect(() => findSplits(pool, [['P1', 'Nobody']])).toThrow();
    expect(() => findSplits(pool, [['P1', 'P2'], ['P2', 'P3']])).toThrow();
  });
});
