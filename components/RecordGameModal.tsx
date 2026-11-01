'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_EMOJI, type Role } from '@/lib/types';

interface Player {
  name: string;
  role: Role;
}

interface Props {
  team1: Player[];
  team2: Player[];
  onClose: () => void;
  onSuccess?: (gameId: number) => void;
}

export default function RecordGameModal({ team1, team2, onClose, onSuccess }: Props) {
  const router = useRouter();
  const [modalTeams, setModalTeams] = useState<{ a: Player[]; b: Player[] }>({
    a: [...team1],
    b: [...team2],
  });
  const [editMode, setEditMode] = useState(false);
  const [grabbed, setGrabbed] = useState<{ team: 0 | 1; idx: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  function handleGrab(team: 0 | 1, idx: number) {
    if (!grabbed) {
      setGrabbed({ team, idx });
      return;
    }

    const srcTeam = grabbed.team === 0 ? [...modalTeams.a] : [...modalTeams.b];
    const dstTeam = team === 0 ? [...modalTeams.a] : [...modalTeams.b];
    const srcPlayer = srcTeam[grabbed.idx];
    const dstPlayer = dstTeam[idx];

    if (grabbed.team === team) {
      // Swap within same team
      srcTeam[grabbed.idx] = { ...dstPlayer, role: srcPlayer.role };
      srcTeam[idx] = { ...srcPlayer, role: dstPlayer.role };
      setModalTeams(grabbed.team === 0 ? { a: srcTeam, b: modalTeams.b } : { a: modalTeams.a, b: srcTeam });
    } else {
      // Swap between teams
      srcTeam[grabbed.idx] = { ...dstPlayer, role: srcPlayer.role };
      dstTeam[idx] = { ...srcPlayer, role: dstPlayer.role };
      setModalTeams({ a: grabbed.team === 0 ? srcTeam : dstTeam, b: grabbed.team === 1 ? srcTeam : dstTeam });
    }
    setGrabbed(null);
  }

  async function record(winner: 0 | 1) {
    setBusy(true);
    setErr('');

    const body = {
      date: new Date().toLocaleDateString('en-CA'),
      winner,
      team0: modalTeams.a.map(({ name, role }) => ({ player: name, role })),
      team1: modalTeams.b.map(({ name, role }) => ({ player: name, role })),
    };

    const r = await fetch('/api/matches', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    const j = await r.json();
    setBusy(false);

    if (!r.ok) {
      setErr(j.error);
      return;
    }

    onClose();
    onSuccess?.(j.id);
    router.refresh();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Record Game Result</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {err && <div className="err">{err}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!editMode ? (
            <>
              <div className="grid g2" style={{ gap: 12 }}>
                <div className="card team-blue">
                  <b>Team 1</b>
                  <table>
                    <tbody>
                      {modalTeams.a.map((p) => (
                        <tr key={p.name}>
                          <td>{ROLE_EMOJI[p.role]}</td>
                          <td>{p.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card team-red">
                  <b>Team 2</b>
                  <table>
                    <tbody>
                      {modalTeams.b.map((p) => (
                        <tr key={p.name}>
                          <td>{ROLE_EMOJI[p.role]}</td>
                          <td>{p.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="muted small">
                Wrong teams?{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setEditMode(true); }}>
                  Swap players
                </a>
              </p>
              <div className="row">
                <button className="big blue" disabled={busy} onClick={() => record(0)}>
                  Team 1 won
                </button>
                <button className="big red" disabled={busy} onClick={() => record(1)}>
                  Team 2 won
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="muted small">Click two players to swap them (role stays with position).</p>
              <div className="grid g2" style={{ gap: 12 }}>
                <div className="card team-blue">
                  <b>Team 1</b>
                  <table>
                    <tbody>
                      {modalTeams.a.map((p, i) => (
                        <tr key={p.name}>
                          <td>{ROLE_EMOJI[p.role]}</td>
                          <td>{p.name}</td>
                          <td>
                            <button
                              className={`grab ${grabbed?.team === 0 && grabbed?.idx === i ? 'on' : ''}`}
                              onClick={() => handleGrab(0, i)}
                            >
                              ⇅
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="card team-red">
                  <b>Team 2</b>
                  <table>
                    <tbody>
                      {modalTeams.b.map((p, i) => (
                        <tr key={p.name}>
                          <td>{ROLE_EMOJI[p.role]}</td>
                          <td>{p.name}</td>
                          <td>
                            <button
                              className={`grab ${grabbed?.team === 1 && grabbed?.idx === i ? 'on' : ''}`}
                              onClick={() => handleGrab(1, i)}
                            >
                              ⇅
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="muted small">
                <a href="#" onClick={(e) => { e.preventDefault(); setEditMode(false); setGrabbed(null); }}>
                  Done swapping
                </a>
              </p>
              <div className="row">
                <button className="big blue" disabled={busy} onClick={() => record(0)}>
                  Team 1 won
                </button>
                <button className="big red" disabled={busy} onClick={() => record(1)}>
                  Team 2 won
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
