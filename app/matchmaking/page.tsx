import { load } from '@/lib/page';
import { isAdmin } from '@/lib/auth';
import Matchmaker from '@/components/Matchmaker';

export const dynamic = 'force-dynamic';
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
