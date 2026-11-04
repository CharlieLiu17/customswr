import { load } from '@/lib/page';
import { isAdmin } from '@/lib/auth';
import GameEntry from '@/components/GameEntry';
import championRoles from '@/data/champion-roles.json';
import championTemplates from '@/data/champion-templates.json';

export const dynamic = 'force-dynamic';

export default async function NewGame() {
  const { players } = await load();
  const admin = await isAdmin();
  const activePlayers = players.filter(p => p.active);
  const allPlayers = activePlayers.concat(players.filter(p => !p.active));

  // Build IGN -> player name mapping for import
  const ignMap: Record<string, string> = {};
  for (const p of activePlayers) {
    for (const ign of p.igns) {
      ignMap[ign.toLowerCase()] = p.name;
    }
  }

  return (
    <GameEntry
      admin={admin}
      players={allPlayers.map(p => ({ name: p.name, mmr: p.mmr, playable: p.playable_roles, active: p.active }))}
      knownPlayers={activePlayers.map(p => p.name)}
      ignMap={ignMap}
      championRoles={championRoles as Record<string, { name: string; roles: string[] }>}
      championTemplates={championTemplates as Record<string, { name: string; rgb: number[] }>}
    />
  );
}
