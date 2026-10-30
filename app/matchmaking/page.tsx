import { load } from '@/lib/page';
import { isAdmin } from '@/lib/auth';
import Matchmaker from '@/components/Matchmaker';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const { players, lines } = await load();
  const games = new Map<string, number>(); for (const l of lines) games.set(l.player, (games.get(l.player) ?? 0) + 1);
  return (<><h1>Matchmaking</h1>
    <p className="muted">Select the 10 players. The app checks every possible split, drops any with two same-role one-tricks or an unfillable role, and ranks the rest by MMR gap.</p>
    <Matchmaker admin={await isAdmin()} players={players.map((p) => ({ name: p.name, mmr: p.mmr, active: p.active, games: games.get(p.name) ?? 0 }))} /></>);
}
