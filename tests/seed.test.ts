import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyResult, mmrDelta } from '../lib/mmr';

const seed = JSON.parse(readFileSync('data/seed.json', 'utf8'));

describe('import fidelity vs. the Google Sheet', () => {
  it('every player Wins/Losses matches the sheet totals', () => {
    const t = new Map<string, [number, number]>();
    for (const m of seed.matches) for (const e of m.entries) { const c = t.get(e.player) ?? [0, 0]; c[e.result === 'W' ? 0 : 1]++; t.set(e.player, c); }
    let checked = 0;
    for (const p of seed.players) {
      if (p.sheet_wins == null) continue;
      expect(t.get(p.name) ?? [0, 0], p.name).toEqual([p.sheet_wins, p.sheet_losses]); checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(40);
  });
  it('265+ games have exactly 5 wins and 5 losses; the rest are flagged incomplete', () => {
    const complete = seed.matches.filter((m: any) => !m.incomplete);
    for (const m of complete) expect(m.entries.length).toBe(10);
    expect(complete.length).toBeGreaterThan(260);
  });
  it('replaying the MMR formula reproduces the sheet MMR after each game (>99%)', () => {
    const prev = new Map<string, number>(); for (const p of seed.players) prev.set(p.name, p.start_mmr);
    let ok = 0, total = 0;
    for (const m of seed.matches) for (const e of m.entries) {
      const calc = applyResult(e.result, prev.get(e.player)!, e.base_mmr);
      total++; if (Math.abs(calc - e.mmr_after) <= 0.51) ok++;
      prev.set(e.player, e.mmr_after); // resync to sheet so hand-edits don't cascade
    }
    expect(ok / total).toBeGreaterThan(0.99);
  });
  it('only a handful of players have manual MMR corrections after their last game', () => {
    const diff = seed.players.filter((p: any) => {
      const last = [...seed.matches].reverse().flatMap((m: any) => m.entries).find((e: any) => e.player === p.name);
      return last && last.mmr_after !== p.current_mmr;
    }).map((p: any) => p.name).sort();
    expect(diff).toEqual(['Aditya', 'CurryMonster821', 'Ziji3', 'aakash12']);
  });
});

describe('mmrDelta', () => {
  it('±15 at baseline', () => { expect(mmrDelta('W', 1200, 1200)).toBe(15); expect(mmrDelta('L', 1200, 1200)).toBe(-15); });
  it('rubber-bands every 60 points, truncating toward zero like QUOTIENT', () => {
    expect(mmrDelta('W', 1259, 1200)).toBe(15);  // 59 -> q=0
    expect(mmrDelta('W', 1260, 1200)).toBe(14);  // 60 -> q=1
    expect(mmrDelta('L', 1260, 1200)).toBe(-16);
    expect(mmrDelta('W', 1141, 1200)).toBe(15);  // -59 -> q=0 (trunc, not floor)
    expect(mmrDelta('W', 1140, 1200)).toBe(16);  // -60 -> q=-1
    expect(mmrDelta('L', 1140, 1200)).toBe(-14);
  });
  it('known sheet transitions', () => { // Charlezard: 1452 -> 1437 (L at base), 1437 -> 1452 (W) with base 1452
    expect(applyResult('L', 1452, 1452)).toBe(1437); expect(applyResult('W', 1437, 1452)).toBe(1452);
  });
  it('never flips sign far from baseline', () => { expect(mmrDelta('W', 3000, 1000)).toBe(0); expect(mmrDelta('L', 0, 1000)).toBe(0); });
});
