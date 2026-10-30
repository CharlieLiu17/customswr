import { handler } from '@/lib/api';
import { getLines, getPlayers } from '@/lib/data';
import { findSplits, type MMPlayer } from '@/lib/matchmaking';
import { relations, teamAgainst, teamSynergy } from '@/lib/stats';
import { ROLES, type Role } from '@/lib/types';

export const POST = handler(async (req) => {
  const { players: names } = (await req.json()) as { players: string[] };
  if (!Array.isArray(names) || names.length !== 10) throw new Error('Pick exactly 10 players');
  const [all, lines] = await Promise.all([getPlayers(), getLines()]);
  const byName = new Map(all.map((p) => [p.name, p]));
  const counts = new Map<string, Partial<Record<Role, number>>>();
  for (const l of lines) if (l.role) { const c = counts.get(l.player) ?? {}; c[l.role] = (c[l.role] ?? 0) + 1; counts.set(l.player, c); }
  const pool: MMPlayer[] = names.map((n) => {
    const p = byName.get(n); if (!p) throw new Error(`Unknown player ${n}`);
    return { name: p.name, mmr: p.mmr, playable: p.playable_roles, oneTrick: p.one_trick_role, roleCounts: counts.get(n) };
  });
  const splits = findSplits(pool);
  if (!splits.length) {
    const noRole = pool.filter((p) => !p.playable.length).map((p) => p.name);
    throw new Error(noRole.length ? `${noRole.join(', ')} has no playable roles set.` : 'No valid split: these 10 players cannot fill 5 roles on both teams without two same-role one-tricks together.');
  }
  const rel = relations(lines);
  const side = (t: (typeof splits)[number]['a'], other: (typeof splits)[number]['a']) => {
    const mine = t.players.map((p) => p.name), theirs = other.players.map((p) => p.name);
    const synergy = teamSynergy(rel, mine), against = teamAgainst(rel, mine, theirs);
    const parts = [synergy, against].filter((x): x is number => x !== null);
    return { ...t, synergy, against, estimate: parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null };
  };
  // Filter splits where both teams have estimated win rate < 56%
  const withEstimates = splits.map((s) => ({ delta: s.delta, a: side(s.a, s.b), b: side(s.b, s.a) }));
  const balanced = withEstimates.filter((s) => (s.a.estimate === null || s.a.estimate < 0.56) && (s.b.estimate === null || s.b.estimate < 0.56));
  const options = balanced.length > 0 ? balanced : withEstimates; // fall back to all if none pass filter
  return { total: options.length, options: options.slice(0, 6), roles: ROLES };
});
