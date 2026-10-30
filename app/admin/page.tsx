import { load } from '@/lib/page';
import { isAdmin } from '@/lib/auth';
import AdminPanel, { LoginForm } from '@/components/AdminPanel';

export const dynamic = 'force-dynamic';
export default async function Admin() {
  if (!(await isAdmin())) return (<><h1>Admin login</h1><p className="muted">Anyone can view stats. A password is needed to log games and manage players.</p><LoginForm /></>);
  const { players } = await load();
  return (<><h1>Admin</h1><AdminPanel players={players.map((p) => ({ id: p.id, name: p.name, mmr: p.mmr, baseline: p.baseline_mmr, active: p.active, oneTrick: p.one_trick_role, roles: p.playable_roles }))} /></>);
}
