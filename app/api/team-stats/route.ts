import { handler } from '@/lib/api';
import { getLines } from '@/lib/data';
import { relations, teamAgainst, teamSynergy } from '@/lib/stats';

export const POST = handler(async (req) => {
  const { teamA, teamB } = (await req.json()) as { teamA: string[]; teamB: string[] };
  if (!Array.isArray(teamA) || !Array.isArray(teamB) || teamA.length !== 5 || teamB.length !== 5) {
    throw new Error('Each team must have exactly 5 players');
  }
  const lines = await getLines();
  const rel = relations(lines);
  const synergyA = teamSynergy(rel, teamA);
  const againstA = teamAgainst(rel, teamA, teamB);
  const partsA = [synergyA, againstA].filter((x): x is number => x !== null);
  const estimateA = partsA.length ? partsA.reduce((a, b) => a + b, 0) / partsA.length : null;
  const synergyB = teamSynergy(rel, teamB);
  const againstB = teamAgainst(rel, teamB, teamA);
  const partsB = [synergyB, againstB].filter((x): x is number => x !== null);
  const estimateB = partsB.length ? partsB.reduce((a, b) => a + b, 0) / partsB.length : null;
  return {
    a: { synergy: synergyA, against: againstA, estimate: estimateA },
    b: { synergy: synergyB, against: againstB, estimate: estimateB },
  };
});
