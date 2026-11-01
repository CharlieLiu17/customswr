'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import { ROLES, ROLE_EMOJI, type Role } from '@/lib/types';

interface ChampionData {
  name: string;
  roles: string[];
}

interface ChampionTemplate {
  name: string;
  rgb: number[];
}

interface Props {
  knownPlayers: string[];
  ignMap: Record<string, string>;
  championRoles: Record<string, ChampionData>;
  championTemplates: Record<string, ChampionTemplate>;
}

interface PlayerEntry {
  name: string;
  champion: string;
  role: Role | '';
  team: 1 | 2;
  matched: boolean;
}

const EMPTY_PLAYERS: PlayerEntry[] = Array.from({ length: 10 }, (_, i) => ({
  name: '',
  champion: '',
  role: '',
  team: i < 5 ? 1 : 2,
  matched: false,
}));

// Template size - inner square inscribed in circular portrait
const TEMPLATE_SIZE = 27;

// Fixed offset from OCR bbox to icon center
const ICON_OFFSET_X = -45;
const ICON_OFFSET_Y = -8;

// Crop ratio for center square
const CROP_RATIO = 1 / Math.sqrt(2);

// Compute RGB Mean Squared Error between image data and template
function computeMSE(imgData: Uint8ClampedArray, templateRgb: number[]): number {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < imgData.length; i += 4) {
    const ri = i / 4 * 3;
    const dr = imgData[i] - templateRgb[ri];
    const dg = imgData[i + 1] - templateRgb[ri + 1];
    const db = imgData[i + 2] - templateRgb[ri + 2];
    sum += dr * dr + dg * dg + db * db;
    count++;
  }
  return sum / (count * 3);
}

export default function ScreenshotUploader({ knownPlayers, ignMap, championRoles, championTemplates }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [players, setPlayers] = useState<PlayerEntry[]>(EMPTY_PLAYERS);
  const [championSearch, setChampionSearch] = useState<Record<number, string>>({});
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const normalizeRole = (r: string): Role => {
    const map: Record<string, Role> = { top: 'Top', jungle: 'Jungle', mid: 'Mid', bot: 'Bottom', support: 'Support' };
    return map[r.toLowerCase()] || r as Role;
  };

  const championList = Object.entries(championRoles).map(([id, data]) => ({
    id,
    name: data.name,
    roles: data.roles.map(normalizeRole),
  })).sort((a, b) => a.name.localeCompare(b.name));

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage(e.target?.result as string);
      setError('');
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFile(file);
        break;
      }
    }
  }, [handleFile]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // Find champion icon at fixed offset from name bbox
  const findChampionAtPosition = async (
    ctx: CanvasRenderingContext2D,
    nameX: number,
    nameY: number,
    playerName: string  // for debug saving
  ): Promise<{ id: string; name: string; mse: number } | null> => {
    const templateEntries = Object.entries(championTemplates);

    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = TEMPLATE_SIZE;
    smallCanvas.height = TEMPLATE_SIZE;
    const smallCtx = smallCanvas.getContext('2d')!;

    let bestMatch: { id: string; name: string; mse: number } | null = null;

    // Fixed position: exact offset from OCR bbox (no search - trust the offset)
    const iconX = nameX + ICON_OFFSET_X;
    const iconY = nameY + ICON_OFFSET_Y;

    if (iconX < 0 || iconY < 0) return null;

    try {
      // Extract 27x27 region directly (already the inner square size)
      smallCtx.drawImage(
        ctx.canvas,
        iconX, iconY, TEMPLATE_SIZE, TEMPLATE_SIZE,
        0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE
      );

      const imgData = smallCtx.getImageData(0, 0, TEMPLATE_SIZE, TEMPLATE_SIZE).data;

      // Compare against all champion templates
      for (const [id, { name, rgb }] of templateEntries) {
        const mse = computeMSE(imgData, rgb);
        if (!bestMatch || mse < bestMatch.mse) {
          bestMatch = { id, name, mse };
        }
      }

      // Save crop for debugging
      const dataUrl = smallCanvas.toDataURL('image/png');
      fetch('/api/debug-crop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName, dataUrl }),
      }).catch(() => {});
    } catch {
      // Skip if drawing fails
    }

    return bestMatch;
  };

  const runExtraction = async () => {
    if (!image) return;
    setProcessing(true);
    setError('');

    try {
      // Load image
      setStatus('Loading image...');
      const img = new Image();
      img.src = image;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Draw to canvas
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Run OCR with bounding boxes
      setStatus('Running OCR...');
      const worker = await createWorker('eng');
      const { data } = await worker.recognize(img, {}, { blocks: true });
      await worker.terminate();

      // Extract words with bounding boxes
      const words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> = [];
      for (const block of data.blocks || []) {
        for (const para of block.paragraphs || []) {
          for (const line of para.lines || []) {
            for (const word of line.words || []) {
              words.push(word);
            }
          }
        }
      }

      // Fuzzy match for OCR errors
      const fuzzyMatch = (ocrText: string, targetName: string): boolean => {
        if (ocrText.includes(targetName) || targetName.includes(ocrText)) {
          return ocrText.length >= targetName.length * 0.4;
        }
        const minLen = Math.min(ocrText.length, targetName.length);
        let commonPrefix = 0;
        for (let i = 0; i < minLen; i++) {
          if (ocrText[i] === targetName[i]) commonPrefix++;
          else break;
        }
        return commonPrefix >= 4 && commonPrefix >= minLen * 0.6;
      };

      // Match words to player names/IGNs
      interface DetectedPlayer {
        playerName: string;
        bbox: { x0: number; y0: number; x1: number; y1: number };
        champion: string | null;
      }

      const detectedPlayers: DetectedPlayer[] = [];
      const usedPlayerNames = new Set<string>();

      for (const word of words) {
        const text = word.text.replace(/[^a-zA-Z0-9]/g, '');
        if (text.length < 3) continue;

        const cleanText = text.toLowerCase();
        let matchedPlayer: string | null = null;

        // Check player names first
        for (const name of knownPlayers) {
          if (usedPlayerNames.has(name)) continue;
          const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          if (fuzzyMatch(cleanText, cleanName)) {
            matchedPlayer = name;
            break;
          }
        }

        // Check IGNs
        if (!matchedPlayer) {
          for (const [ign, name] of Object.entries(ignMap)) {
            if (usedPlayerNames.has(name)) continue;
            const cleanIgn = ign.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            if (fuzzyMatch(cleanText, cleanIgn)) {
              matchedPlayer = name;
              break;
            }
          }
        }

        if (matchedPlayer) {
          usedPlayerNames.add(matchedPlayer);
          detectedPlayers.push({
            playerName: matchedPlayer,
            bbox: word.bbox,
            champion: null,
          });
        }
      }

      // Sort by Y first to calculate spacing
      detectedPlayers.sort((a, b) => a.bbox.y0 - b.bbox.y0);

      console.log('Detected players (raw):', detectedPlayers.map(p =>
        `${p.playerName} at (${p.bbox.x0}, ${p.bbox.y0}) size ${p.bbox.x1 - p.bbox.x0}x${p.bbox.y1 - p.bbox.y0}`
      ));

      // Calculate median X and median Y spacing (excluding team gap between player 5 and 6)
      const xValues = detectedPlayers.map(p => p.bbox.x0);
      const medianX = xValues.slice().sort((a, b) => a - b)[Math.floor(xValues.length / 2)];

      const ySpacings: number[] = [];
      for (let i = 1; i < detectedPlayers.length; i++) {
        // Skip the team gap (between index 4 and 5, i.e., players 5 and 6)
        if (i === 5) continue;
        ySpacings.push(detectedPlayers[i].bbox.y0 - detectedPlayers[i - 1].bbox.y0);
      }
      const medianYSpacing = ySpacings.slice().sort((a, b) => a - b)[Math.floor(ySpacings.length / 2)];

      console.log(`Median X: ${medianX}, Median Y spacing: ${medianYSpacing}`);

      // Helper to get same-team neighbor indices
      const getTeamNeighbors = (i: number): number[] => {
        const isTeam1 = i < 5;
        const teamStart = isTeam1 ? 0 : 5;
        const teamEnd = isTeam1 ? 4 : 9;
        const neighbors: number[] = [];
        if (i > teamStart) neighbors.push(i - 1);
        if (i < teamEnd) neighbors.push(i + 1);
        return neighbors;
      };

      // Helper to check if spacing is off
      const isSpacingOff = (y1: number, y2: number): boolean => {
        return Math.abs(Math.abs(y2 - y1) - medianYSpacing) > 5;
      };

      // Identify misaligned players using two-neighbor check
      const misaligned = new Set<number>();

      for (let i = 0; i < detectedPlayers.length; i++) {
        const neighbors = getTeamNeighbors(i);
        const myY = detectedPlayers[i].bbox.y0;

        if (neighbors.length === 2) {
          // Middle player: check both neighbors
          const prevOff = isSpacingOff(detectedPlayers[neighbors[0]].bbox.y0, myY);
          const nextOff = isSpacingOff(myY, detectedPlayers[neighbors[1]].bbox.y0);

          if (prevOff && nextOff) {
            misaligned.add(i);
            console.log(`${detectedPlayers[i].playerName}: MISALIGNED (both neighbors show bad spacing)`);
          }
        } else if (neighbors.length === 1) {
          // Edge player: check 1st and 2nd neighbor
          const isFirst = i === 0 || i === 5;
          const neighbor1 = neighbors[0];
          const neighbor2 = isFirst ? neighbor1 + 1 : neighbor1 - 1;

          if (neighbor2 >= 0 && neighbor2 < detectedPlayers.length &&
              ((i < 5 && neighbor2 < 5) || (i >= 5 && neighbor2 >= 5))) {
            const spacing2 = Math.abs(detectedPlayers[neighbor2].bbox.y0 - myY);
            const expectedSpacing2 = medianYSpacing * 2;

            const neighbor1Off = isSpacingOff(myY, detectedPlayers[neighbor1].bbox.y0);
            const neighbor2Off = Math.abs(spacing2 - expectedSpacing2) > 10;

            if (neighbor1Off && neighbor2Off) {
              misaligned.add(i);
              console.log(`${detectedPlayers[i].playerName}: MISALIGNED (edge player, both neighbor spacings off)`);
            } else if (neighbor1Off && !neighbor2Off) {
              misaligned.add(neighbor1);
              console.log(`${detectedPlayers[neighbor1].playerName}: MISALIGNED (detected from edge player ${detectedPlayers[i].playerName})`);
            }
          }
        }
      }

      // Correct bounding boxes
      for (let i = 0; i < detectedPlayers.length; i++) {
        const player = detectedPlayers[i];
        let correctedX = player.bbox.x0;
        let correctedY = player.bbox.y0;

        // If X is off by more than 2px from median, use median
        if (Math.abs(player.bbox.x0 - medianX) > 2) {
          console.log(`${player.playerName}: X corrected from ${player.bbox.x0} to ${medianX}`);
          correctedX = medianX;
        }

        // If this player is misaligned, find nearest correct anchor and calculate Y
        if (misaligned.has(i)) {
          const isTeam1 = i < 5;
          const teamStart = isTeam1 ? 0 : 5;
          const teamEnd = isTeam1 ? 4 : 9;

          // Search for nearest non-misaligned player as anchor
          let anchor = -1;
          let anchorDist = Infinity;
          for (let j = teamStart; j <= teamEnd; j++) {
            if (!misaligned.has(j) && Math.abs(j - i) < anchorDist) {
              anchor = j;
              anchorDist = Math.abs(j - i);
            }
          }

          if (anchor !== -1) {
            const anchorY = (detectedPlayers[anchor] as any).correctedY ?? detectedPlayers[anchor].bbox.y0;
            correctedY = anchorY + (i - anchor) * medianYSpacing;
            console.log(`${player.playerName}: Y corrected from ${player.bbox.y0} to ${correctedY} (anchored from ${detectedPlayers[anchor].playerName})`);
          }
        }

        (player as any).correctedX = correctedX;
        (player as any).correctedY = correctedY;
      }

      // Find champions at fixed offset from each detected name
      setStatus('Detecting champions...');
      for (const player of detectedPlayers) {
        const x0 = (player as any).correctedX ?? player.bbox.x0;
        const y0 = (player as any).correctedY ?? player.bbox.y0;

        const champMatch = await findChampionAtPosition(ctx, x0, y0, player.playerName);
        if (champMatch) {
          const champData = championList.find(c => c.id === champMatch.id);
          player.champion = champData?.name || champMatch.name;
          console.log(`${player.playerName} -> ${player.champion} (MSE: ${champMatch.mse.toFixed(0)})`);
        }
      }

      // Sort by Y coordinate and assign to teams
      detectedPlayers.sort((a, b) => a.bbox.y0 - b.bbox.y0);

      const newPlayers = [...EMPTY_PLAYERS];
      detectedPlayers.slice(0, 5).forEach((p, i) => {
        newPlayers[i].name = p.playerName;
        newPlayers[i].champion = p.champion || '';
        newPlayers[i].matched = true;
      });
      detectedPlayers.slice(5, 10).forEach((p, i) => {
        newPlayers[5 + i].name = p.playerName;
        newPlayers[5 + i].champion = p.champion || '';
        newPlayers[5 + i].matched = true;
      });

      setPlayers(newPlayers);
      setStatus(`Found ${detectedPlayers.length} players`);
    } catch (err) {
      setError('Extraction failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setProcessing(false);
    }
  };

  const updatePlayer = (idx: number, field: keyof PlayerEntry, value: string) => {
    setPlayers(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      if (field === 'champion') {
        const champ = championList.find(c => c.name.toLowerCase() === value.toLowerCase());
        if (champ && !next[idx].role) {
          const availableRoles = ROLES.filter(r =>
            champ.roles.includes(r) &&
            !next.some((p, i) => i !== idx && p.team === next[idx].team && p.role === r)
          );
          if (availableRoles.length === 1) {
            next[idx].role = availableRoles[0];
          }
        }
      }
      return next;
    });
  };

  const autoAssignRoles = () => {
    setPlayers(prev => {
      const next = [...prev];
      for (const teamNum of [1, 2] as const) {
        const teamIndices = next.map((p, i) => p.team === teamNum ? i : -1).filter(i => i >= 0);
        const assigned = new Set<Role>();

        teamIndices.forEach(i => {
          if (next[i].role) assigned.add(next[i].role as Role);
        });

        let changed = true;
        while (changed) {
          changed = false;
          for (const idx of teamIndices) {
            if (next[idx].role) continue;
            const champ = championList.find(c => c.name.toLowerCase() === next[idx].champion.toLowerCase());
            if (!champ) continue;

            const availableRoles = ROLES.filter(r => champ.roles.includes(r) && !assigned.has(r));
            if (availableRoles.length === 1) {
              next[idx].role = availableRoles[0];
              assigned.add(availableRoles[0]);
              changed = true;
            }
          }
        }
      }
      return next;
    });
  };

  const filteredChampions = (idx: number) => {
    const search = (championSearch[idx] || '').toLowerCase();
    if (!search) return championList.slice(0, 10);
    return championList.filter(c => c.name.toLowerCase().includes(search)).slice(0, 10);
  };

  const isValid = players.every(p => p.name && p.champion && p.role);

  const handleSubmit = () => {
    const team1 = players.filter(p => p.team === 1);
    const team2 = players.filter(p => p.team === 2);
    console.log('Teams:', { team1, team2 });
  };

  return (
    <div className="col" style={{ gap: 20 }}>
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Upload area */}
      <div
        className="card"
        style={{
          border: '2px dashed var(--line)',
          textAlign: 'center',
          padding: 40,
          cursor: 'pointer',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {image ? (
          <img src={image} alt="Screenshot" style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 8 }} />
        ) : (
          <div>
            <p style={{ fontSize: 18, marginBottom: 8 }}>Drop or paste a screenshot</p>
            <p className="muted small">Or click to select a file</p>
          </div>
        )}
      </div>

      {image && (
        <div className="row">
          <button onClick={runExtraction} disabled={processing} className="primary">
            {processing ? status : 'Extract Players & Champions'}
          </button>
          <button onClick={() => { setImage(null); setPlayers(EMPTY_PLAYERS); setStatus(''); }}>
            Clear
          </button>
        </div>
      )}

      {error && <div className="err">{error}</div>}
      {status && !processing && <div className="muted small">{status}</div>}

      {/* Player entries */}
      <div className="grid g2" style={{ gap: 20 }}>
        {[1, 2].map((teamNum) => (
          <div key={teamNum} className={`card team-${teamNum === 1 ? 'blue' : 'red'}`}>
            <h2 style={{ margin: '0 0 12px' }}>Team {teamNum}</h2>
            <div className="col" style={{ gap: 10 }}>
              {players.filter(p => p.team === teamNum).map((player, i) => {
                const idx = teamNum === 1 ? i : i + 5;
                return (
                  <div key={idx} className="row" style={{ gap: 8 }}>
                    <span style={{ width: 20, color: 'var(--muted)' }}>{i + 1}</span>

                    {/* Player name */}
                    <select
                      value={player.name}
                      onChange={(e) => updatePlayer(idx, 'name', e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select player...</option>
                      {knownPlayers
                        .filter(n => n === player.name || !players.some(p => p.name === n))
                        .map(n => <option key={n} value={n}>{n}</option>)
                      }
                    </select>

                    {/* Champion */}
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Champion..."
                        value={championSearch[idx] ?? player.champion}
                        onChange={(e) => {
                          setChampionSearch(prev => ({ ...prev, [idx]: e.target.value }));
                        }}
                        onFocus={() => setChampionSearch(prev => ({ ...prev, [idx]: player.champion }))}
                        onBlur={() => {
                          setTimeout(() => {
                            setChampionSearch(prev => {
                              const next = { ...prev };
                              delete next[idx];
                              return next;
                            });
                          }, 200);
                        }}
                        style={{ width: '100%' }}
                      />
                      {championSearch[idx] !== undefined && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--panel)',
                          border: '1px solid var(--line)',
                          borderRadius: 8,
                          zIndex: 10,
                          maxHeight: 200,
                          overflowY: 'auto',
                        }}>
                          {filteredChampions(idx).map(c => (
                            <div
                              key={c.id}
                              style={{ padding: '8px 10px', cursor: 'pointer' }}
                              onMouseDown={() => {
                                updatePlayer(idx, 'champion', c.name);
                                setChampionSearch(prev => {
                                  const next = { ...prev };
                                  delete next[idx];
                                  return next;
                                });
                              }}
                            >
                              {c.name} <span className="muted small">({c.roles.join('/')})</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Role */}
                    <select
                      value={player.role}
                      onChange={(e) => updatePlayer(idx, 'role', e.target.value)}
                      style={{ width: 100 }}
                    >
                      <option value="">Role...</option>
                      {ROLES.map(r => (
                        <option key={r} value={r} disabled={players.some((p, j) => j !== idx && p.team === player.team && p.role === r)}>
                          {ROLE_EMOJI[r]} {r}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="row">
        <button onClick={autoAssignRoles}>Auto-assign Roles</button>
        <span style={{ flex: 1 }} />
        <button className="primary" disabled={!isValid} onClick={handleSubmit}>
          Continue to Record Game
        </button>
      </div>
    </div>
  );
}
