import { Metadata } from 'next';
import { load } from '@/lib/page';
import { isAdmin } from '@/lib/auth';
import { findSplits, type MMPlayer } from '@/lib/matchmaking';
import { ROLE_EMOJI, type Role } from '@/lib/types';
import Matchmaker from '@/components/Matchmaker';

export const dynamic = 'force-dynamic';

function parseParams(sp: { p?: string; m?: string; d?: string }, playerNames: string[]): { names: string[]; pick: number } {
  if (sp.d) {
    const SHIFT = 7;
    if (sp.d.length === 11) {
      const indices = sp.d.slice(0, 10).split('').map((c) => (c.charCodeAt(0) - 65 - SHIFT + 62) % 62);
      const pick = (sp.d.charCodeAt(10) - 65 - SHIFT + 62) % 62;
      const names = indices.map((i) => playerNames[i]).filter(Boolean);
      return { names, pick };
    }
    // Legacy dot-separated format
    const parts = sp.d.split('.');
    if (parts.length >= 11) {
      const indices = parts.slice(0, 10).map(Number);
      const pick = parseInt(parts[10], 10) || 0;
      const names = indices.map((i) => playerNames[i]).filter(Boolean);
      return { names, pick };
    }
  }
  return { names: sp.p ? sp.p.split(',') : [], pick: sp.m ? parseInt(sp.m, 10) : 0 };
}

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ p?: string; m?: string; d?: string }> }): Promise<Metadata> {
  const sp = await searchParams;

  try {
    const { players, lines } = await load();
    const playerNames = players.map((p) => p.name);
    const { names, pick: metaPick } = parseParams(sp, playerNames);
    if (names.length !== 10) return { title: 'Matchmaking' };
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

    const o = splits[Math.min(metaPick, splits.length - 1)];

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

export default async function Page({ searchParams }: { searchParams: Promise<{ p?: string; m?: string; d?: string }> }) {
  const sp = await searchParams;
  const { players, lines } = await load();
  const games = new Map<string, number>(); for (const l of lines) games.set(l.player, (games.get(l.player) ?? 0) + 1);
  // Calculate games played in last 30 unique games
  const recentSeqs = [...new Set(lines.map((l) => l.seq))].sort((a, b) => b - a).slice(0, 30);
  const recentSet = new Set(recentSeqs);
  const recentGames = new Map<string, number>();
  for (const l of lines) if (recentSet.has(l.seq)) recentGames.set(l.player, (recentGames.get(l.player) ?? 0) + 1);
  const playerNames = players.map((p) => p.name);
  const { names, pick } = parseParams(sp, playerNames);
  const initialPlayers = names.filter((n) => players.some((p) => p.name === n));
  const initialPick = pick;
  return (<><h1>Matchmaking</h1>
    <Matchmaker admin={await isAdmin()} players={players.map((p) => ({ name: p.name, mmr: p.mmr, active: p.active, games: games.get(p.name) ?? 0, recentGames: recentGames.get(p.name) ?? 0 }))} initialSelection={initialPlayers} initialPick={initialPick} /></>);
}
