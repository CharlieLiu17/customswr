import { load } from '@/lib/page';
import { isAdmin } from '@/lib/auth';
import MatchForm from '@/components/MatchForm';

export const dynamic = 'force-dynamic';
export default async function New() {
  const { players } = await load();
  return (<><h1>Log a game</h1>
    <p className="muted">Pick the five players per role, then tap the winning team. Used the matchmaker? Record the result there instead — it fills everything in for you.</p>
    <MatchForm admin={await isAdmin()} players={players.filter((p) => p.active).concat(players.filter((p) => !p.active)).map((p) => ({ name: p.name, mmr: p.mmr, playable: p.playable_roles, active: p.active }))} /></>);
}
