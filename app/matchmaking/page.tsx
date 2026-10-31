import { Metadata } from 'next';
import { load } from '@/lib/page';
import { isAdmin } from '@/lib/auth';
import { findSplits, type MMPlayer } from '@/lib/matchmaking';
import { ROLE_EMOJI, type Role } from '@/lib/types';
import Matchmaker from '@/components/Matchmaker';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ p?: string; m?: string }> }): Promise<Metadata> {
  const sp = await searchParams;
  if (!sp.p) return { title: 'Matchmaking' };

  const names = sp.p.split(',');
  if (names.length !== 10) return { title: 'Matchmaking' };

  try {
    const { players, lines } = await load();
    const byName = new Map(players.map((p) => [p.name, p]));
    const counts = new Map<string, Partial<Record<Role, number>>>();
    for (const l of lines) if (l.role) { const c = counts.get(l.player) ?? {}; c[l.role] = (c[l.role] ?? 0) + 1; counts.set(l.player, c); }

    const pool: MMPlayer[] = [];
    for (const n of names) {
      const p = byName.get(n);
      if (!p) continue;
      pool.push({ name: p.name, mmr: p.mmr, playable: p.playable_roles, oneTrick: p.one_trick_role, roleCounts: counts.get(n) });
    }

    if (pool.length !== 10) return { title: 'Matchmaking' };

    const splits = findSplits(pool);
    if (!splits.length) return { title: 'Matchmaking' };

    const pick = sp.m ? parseInt(sp.m, 10) : 0;
    const o = splits[Math.min(pick, splits.length - 1)];

    const formatTeam = (team: typeof o.a, num: number) =>
      `Team ${num}: ` + team.players.map((p) => `${ROLE_EMOJI[p.role]} ${p.name}`).join(' · ');

    const description = `${formatTeam(o.a, 1)}\n${formatTeam(o.b, 2)}\nDelta: ${Math.round(o.delta)}`;

    return {
      title: 'Customs Match',
      description,
      openGraph: { title: 'Customs Match', description },
    };
  } catch {
    return { title: 'Matchmaking' };
  }
}

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string; m?: string }> }) {
  const sp = await searchParams;
  const { players, lines } = await load();
  const games = new Map<string, number>(); for (const l of lines) games.set(l.player, (games.get(l.player) ?? 0) + 1);
  // Calculate games played in last 30 unique games
  const recentSeqs = [...new Set(lines.map((l) => l.seq))].sort((a, b) => b - a).slice(0, 30);
  const recentSet = new Set(recentSeqs);
  const recentGames = new Map<string, number>();
  for (const l of lines) if (recentSet.has(l.seq)) recentGames.set(l.player, (recentGames.get(l.player) ?? 0) + 1);
  const initialPlayers = sp.p ? sp.p.split(',').filter((n) => players.some((p) => p.name === n)) : [];
  const initialPick = sp.m ? parseInt(sp.m, 10) : 0;
  return (<><h1>Matchmaking</h1>
    <p className="muted">Select the 10 players. The app checks every possible split, drops any with two same-role one-tricks or an unfillable role, and ranks the rest by MMR gap.</p>
    <Matchmaker admin={await isAdmin()} players={players.map((p) => ({ name: p.name, mmr: p.mmr, active: p.active, games: games.get(p.name) ?? 0, recentGames: recentGames.get(p.name) ?? 0 }))} initialSelection={initialPlayers} initialPick={initialPick} /></>);
}
