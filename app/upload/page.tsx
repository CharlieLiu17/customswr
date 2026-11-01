import { load } from '@/lib/page';
import ScreenshotUploader from '@/components/ScreenshotUploader';
import championRoles from '@/data/champion-roles.json';
import championTemplates from '@/data/champion-templates.json';

export const dynamic = 'force-dynamic';

export default async function UploadPage() {
  const { players } = await load();
  const activePlayers = players.filter(p => p.active);
  const playerNames = activePlayers.map(p => p.name);

  // Build IGN -> player name mapping
  const ignMap: Record<string, string> = {};
  for (const p of activePlayers) {
    for (const ign of p.igns) {
      ignMap[ign.toLowerCase()] = p.name;
    }
  }

  return (
    <>
      <h1>Import from Screenshot</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Upload or paste a post-game lobby screenshot. Player names and champions will be extracted automatically.
      </p>
      <ScreenshotUploader
        knownPlayers={playerNames}
        ignMap={ignMap}
        championRoles={championRoles as Record<string, { name: string; roles: string[] }>}
        championTemplates={championTemplates as Record<string, { name: string; rgb: number[] }>}
      />
    </>
  );
}
