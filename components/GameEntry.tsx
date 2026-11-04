'use client';

import { useState } from 'react';
import EditIcon from '@mui/icons-material/Edit';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import MatchForm, { type FormPlayer } from './MatchForm';
import ScreenshotUploader from './ScreenshotUploader';
import ImportTutorialModal from './ImportTutorialModal';

interface Props {
  admin: boolean;
  players: FormPlayer[];
  knownPlayers: string[];
  ignMap: Record<string, string>;
  championRoles: Record<string, { name: string; roles: string[] }>;
  championTemplates: Record<string, { name: string; rgb: number[] }>;
}

export default function GameEntry({ admin, players, knownPlayers, ignMap, championRoles, championTemplates }: Props) {
  const [mode, setMode] = useState<'manual' | 'import'>('import');

  return (
    <>
      {mode === 'import' && <ImportTutorialModal />}
      <div className="row" style={{ marginBottom: 16, gap: 0 }}>
        <button
          className={mode === 'manual' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setMode('manual')}
        >
          <EditIcon style={{ fontSize: 18, marginRight: 6 }} />
          Manual
        </button>
        <button
          className={mode === 'import' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setMode('import')}
        >
          <FileUploadIcon style={{ fontSize: 18, marginRight: 6 }} />
          Import
        </button>
      </div>

      {mode === 'manual' ? (
        <>
          <p className="muted" style={{ marginBottom: 16 }}>
            Manually select players, champions, and roles for each team.
          </p>
          <MatchForm admin={admin} players={players} />
        </>
      ) : (
        <>
          <p className="muted" style={{ marginBottom: 16 }}>
            Upload or paste a post-game lobby screenshot. Player names and champions will be extracted automatically.
          </p>
          <ScreenshotUploader
            knownPlayers={knownPlayers}
            ignMap={ignMap}
            championRoles={championRoles}
            championTemplates={championTemplates}
          />
        </>
      )}
    </>
  );
}
