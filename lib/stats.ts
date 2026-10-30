import { ROLES, type GameLine, type Role } from './types';

export const wr = (w: number, l: number) => (w + l ? w / (w + l) : null);
const popStd = (xs: number[]) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };

/** Sheet formula: 1 - STDEV.P(role shares) * 2.5  (0% = pure one-trick, 100% = perfectly even). */
export function fillScore(roleCounts: Record<Role, number>): number | null {
  const total = ROLES.reduce((s, r) => s + roleCounts[r], 0);
  if (!total) return null;
  return 1 - popStd(ROLES.map((r) => roleCounts[r] / total)) * 2.5;
}

export interface PlayerSummary {
  name: string; wins: number; losses: number; games: number; wr: number | null;
  byRole: Record<Role, { w: number; l: number }>; fill: number | null;
}
export function summarize(lines: GameLine[]): Map<string, PlayerSummary> {
  const m = new Map<string, PlayerSummary>();
  for (const x of lines) {
    let s = m.get(x.player);
    if (!s) {
      s = { name: x.player, wins: 0, losses: 0, games: 0, wr: null, fill: null,
        byRole: Object.fromEntries(ROLES.map((r) => [r, { w: 0, l: 0 }])) as PlayerSummary['byRole'] };
      m.set(x.player, s);
    }
    if (x.result === 'W') s.wins++; else s.losses++;
    if (x.role) s.byRole[x.role][x.result === 'W' ? 'w' : 'l']++;
  }
  for (const s of m.values()) {
    s.games = s.wins + s.losses; s.wr = wr(s.wins, s.losses);
    s.fill = fillScore(Object.fromEntries(ROLES.map((r) => [r, s.byRole[r].w + s.byRole[r].l])) as Record<Role, number>);
  }
  return m;
}

export interface PairStat { w: number; l: number }
export interface Relations {
  /** with[a][b]: a's record when b was on a's team */
  with: Map<string, Map<string, PairStat>>;
  /** against[a][b]: a's record when b was on the other team */
  against: Map<string, Map<string, PairStat>>;
}
function bump(map: Map<string, Map<string, PairStat>>, a: string, b: string, win: boolean) {
  let row = map.get(a); if (!row) map.set(a, (row = new Map()));
  let c = row.get(b); if (!c) row.set(b, (c = { w: 0, l: 0 }));
  if (win) c.w++; else c.l++;
}
export function relations(lines: GameLine[]): Relations {
  const byMatch = new Map<number, GameLine[]>();
  for (const x of lines) { const g = byMatch.get(x.match_id); if (g) g.push(x); else byMatch.set(x.match_id, [x]); }
  const rel: Relations = { with: new Map(), against: new Map() };
  for (const g of byMatch.values()) {
    for (const a of g) for (const b of g) {
      if (a.player_id === b.player_id) continue;
      bump(a.team === b.team ? rel.with : rel.against, a.player, b.player, a.result === 'W');
    }
  }
  return rel;
}
export const pairWr = (m: Map<string, Map<string, PairStat>>, a: string, b: string) => {
  const c = m.get(a)?.get(b); return c ? wr(c.w, c.l) : null;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
/** WR.gs: average of the 10 teammate-pair WRs (pairs with no games are skipped). */
export function teamSynergy(rel: Relations, team: string[]): number | null {
  const v: number[] = [];
  for (let i = 0; i < team.length; i++) for (let j = i + 1; j < team.length; j++) {
    const x = pairWr(rel.with, team[i], team[j]); if (x !== null) v.push(x);
  }
  return mean(v);
}
/** WR.gs: average of the 25 cross-team WRs, from `team`'s point of view. */
export function teamAgainst(rel: Relations, team: string[], other: string[]): number | null {
  const v: number[] = [];
  for (const a of team) for (const b of other) { const x = pairWr(rel.against, a, b); if (x !== null) v.push(x); }
  return mean(v);
}
