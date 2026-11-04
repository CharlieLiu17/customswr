import { notFound } from 'next/navigation';
import { load } from '@/lib/page';
import { isAdmin } from '@/lib/auth';
import { ROLES } from '@/lib/types';
import MatchForm from '@/components/MatchForm';

export const dynamic = 'force-dynamic';
export default async function Edit({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id); const { players, lines } = await load();
  const g = lines.filter((l) => l.match_id === id); if (!g.length) notFound();
  const slots = (team: 0 | 1) => ROLES.map((r) => g.find((l) => l.team === team && l.role === r)?.player ?? '');
  const champions = (team: 0 | 1) => ROLES.map((r) => g.find((l) => l.team === team && l.role === r)?.champion ?? '');
  const winner = g.find((l) => l.result === 'W')?.team ?? null;
  return (<>
    <div className="row" style={{ justifyContent: 'space-between' }}><h1>Edit game #{g[0].seq}</h1><a href="/games" className="btn close-btn">✕</a></div>
    {g[0].incomplete && <p className="muted">The sheet had incomplete data for this game (not 5 winners + 5 losers with roles). Fill in all 10 slots to complete it.</p>}
    <MatchForm admin={await isAdmin()} players={players.map((p) => ({ name: p.name, mmr: p.mmr, playable: p.playable_roles, active: p.active }))}
      initial={{ id, date: g[0].date, team0: slots(0), team1: slots(1), champs0: champions(0), champs1: champions(1), winner: winner as 0 | 1 | null }} />
  </>);
}
