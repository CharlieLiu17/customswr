import { ROLES, type Role } from './types';

export interface MMPlayer {
  name: string; mmr: number; playable: Role[]; oneTrick: Role | null;
  /** optional: how often they've actually played each role (used to pick the nicer role assignment) */
  roleCounts?: Partial<Record<Role, number>>;
}
export interface TeamPlan { players: { name: string; mmr: number; role: Role }[]; total: number }
export interface Split { a: TeamPlan; b: TeamPlan; delta: number }

const PERMS: number[][] = (() => {
  const out: number[][] = [];
  const rec = (cur: number[], rest: number[]) => {
    if (!rest.length) { out.push(cur); return; }
    rest.forEach((x, i) => rec([...cur, x], [...rest.slice(0, i), ...rest.slice(i + 1)]));
  };
  rec([], [0, 1, 2, 3, 4]);
  return out; // 120
})();

/** Best role assignment for a 5-player team, or null if no one-role-each assignment exists. */
export function assignRoles(team: MMPlayer[]): Role[] | null {
  let best: Role[] | null = null, bestScore = -1;
  for (const perm of PERMS) {
    // perm[i] = index of the player who takes ROLES[i]
    let ok = true, score = 0;
    for (let i = 0; i < 5; i++) {
      const p = team[perm[i]];
      if (!p.playable.includes(ROLES[i])) { ok = false; break; }
      score += p.roleCounts?.[ROLES[i]] ?? 0;
    }
    if (ok && score > bestScore) {
      bestScore = score;
      const roles = new Array<Role>(5);
      for (let i = 0; i < 5; i++) roles[perm[i]] = ROLES[i];
      best = roles;
    }
  }
  return best;
}

/** Two one-tricks of the same role on one team is not allowed. */
export function hasOneTrickClash(team: MMPlayer[]): boolean {
  const seen = new Set<Role>();
  for (const p of team) if (p.oneTrick) { if (seen.has(p.oneTrick)) return true; seen.add(p.oneTrick); }
  return false;
}

function plan(team: MMPlayer[], roles: Role[]): TeamPlan {
  const players = team.map((p, i) => ({ name: p.name, mmr: p.mmr, role: roles[i] }))
    .sort((x, y) => ROLES.indexOf(x.role) - ROLES.indexOf(y.role));
  return { players, total: team.reduce((s, p) => s + p.mmr, 0) };
}

/**
 * Exhaustive search of all 126 distinct 5v5 splits of 10 players. Keeps every split that satisfies
 * the one-trick and role-coverage constraints and returns them sorted by MMR gap (best first).
 * Deterministic and guaranteed optimal, unlike the sheet's randomised hill-climb.
 */
export function findSplits(players: MMPlayer[]): Split[] {
  if (players.length !== 10) throw new Error('Matchmaking needs exactly 10 players');
  if (new Set(players.map((p) => p.name)).size !== 10) throw new Error('Duplicate players');
  const out: Split[] = [];
  // fix players[0] on team A so mirrored splits are not counted twice
  for (let mask = 0; mask < 1 << 9; mask++) {
    const a: MMPlayer[] = [players[0]], b: MMPlayer[] = [];
    for (let i = 1; i < 10; i++) ((mask >> (i - 1)) & 1 ? a : b).push(players[i]);
    if (a.length !== 5) continue;
    if (hasOneTrickClash(a) || hasOneTrickClash(b)) continue;
    const ra = assignRoles(a); if (!ra) continue;
    const rb = assignRoles(b); if (!rb) continue;
    const pa = plan(a, ra), pb = plan(b, rb);
    out.push({ a: pa, b: pb, delta: Math.abs(pa.total - pb.total) / 5 });
  }
  return out.sort((x, y) => x.delta - y.delta);
}
