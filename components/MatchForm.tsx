'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ROLES, ROLE_EMOJI, type Role } from '@/lib/types';
import championRolesData from '@/data/champion-roles.json';

export interface FormPlayer { name: string; mmr: number; playable: Role[]; active: boolean }
export interface Initial { id?: number; date: string; team0: (string | '')[]; team1: (string | '')[]; champs0?: (string | '')[]; champs1?: (string | '')[]; winner?: 0 | 1 | null; notes?: string }
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

const championList = Object.entries(championRolesData).map(([id, data]) => ({
  id,
  name: (data as { name: string }).name,
})).sort((a, b) => a.name.localeCompare(b.name));

function championIconPath(champion: string): string {
  const id = champion.replace(/[^a-zA-Z]/g, '').toLowerCase();
  return `/champions/${id}.png`;
}

export default function MatchForm({ players, admin, initial }: { players: FormPlayer[]; admin: boolean; initial?: Initial }) {
  const router = useRouter();
  const [date, setDate] = useState(initial?.date ?? today());
  const [t0, setT0] = useState<string[]>(initial?.team0 ?? ['', '', '', '', '']);
  const [t1, setT1] = useState<string[]>(initial?.team1 ?? ['', '', '', '', '']);
  const [c0, setC0] = useState<string[]>(initial?.champs0 ?? ['', '', '', '', '']);
  const [c1, setC1] = useState<string[]>(initial?.champs1 ?? ['', '', '', '', '']);
  const [champSearch, setChampSearch] = useState<Record<string, string>>({});
  const [winner, setWinner] = useState<0 | 1 | null>(initial?.winner ?? null);
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [grabbed, setGrabbed] = useState<{ team: 0 | 1; idx: number } | null>(null);
  const byName = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const used = new Set([...t0, ...t1].filter(Boolean));
  const complete = t0.every(Boolean) && t1.every(Boolean);

  const filteredChampions = (searchKey: string) => {
    const search = (champSearch[searchKey] || '').toLowerCase();
    if (!search) return championList.slice(0, 8);
    return championList.filter(c => c.name.toLowerCase().includes(search)).slice(0, 8);
  };

  const handleGrab = (team: 0 | 1, idx: number) => {
    if (!grabbed) { setGrabbed({ team, idx }); return; }
    const srcTeam = grabbed.team === 0 ? t0 : t1;
    const dstTeam = team === 0 ? t0 : t1;
    const srcSet = grabbed.team === 0 ? setT0 : setT1;
    const dstSet = team === 0 ? setT0 : setT1;
    const srcPlayer = srcTeam[grabbed.idx];
    const dstPlayer = dstTeam[idx];
    if (grabbed.team === team) {
      // Same team swap
      const newTeam = [...srcTeam];
      newTeam[grabbed.idx] = dstPlayer;
      newTeam[idx] = srcPlayer;
      srcSet(newTeam);
    } else {
      // Cross-team swap
      srcSet(srcTeam.map((p, i) => i === grabbed.idx ? dstPlayer : p));
      dstSet(dstTeam.map((p, i) => i === idx ? srcPlayer : p));
    }
    setGrabbed(null);
  };

  async function save(w: 0 | 1) {
    setWinner(w); setBusy(true); setMsg(null);
    const body = { date, winner: w, notes: notes || null,
      team0: t0.map((player, i) => ({ player, role: ROLES[i], champion: c0[i] || null })),
      team1: t1.map((player, i) => ({ player, role: ROLES[i], champion: c1[i] || null })) };
    const r = await fetch(initial?.id ? `/api/matches/${initial.id}` : '/api/matches', { method: initial?.id ? 'PUT' : 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: j.error }); return; }
    if (initial?.id) { router.push('/games'); router.refresh(); return; }
    setMsg({ ok: true, text: `Saved — Team ${w + 1} won. Teams cleared for the next game.` });
    setT0(['', '', '', '', '']); setT1(['', '', '', '', '']); setC0(['', '', '', '', '']); setC1(['', '', '', '', '']); setWinner(null); router.refresh();
  }

  const col = (label: string, cls: string, team: string[], set: (v: string[]) => void, champs: string[], setChamps: (v: string[]) => void, teamIdx: 0 | 1) => (
    <div className={`card ${cls}`}>
      <b>{label}</b>
      {ROLES.map((role, i) => {
        const opts = players.filter((p) => !used.has(p.name) || p.name === team[i]);
        const can = opts.filter((p) => p.playable.includes(role)), other = opts.filter((p) => !p.playable.includes(role));
        const isGrabbed = grabbed?.team === teamIdx && grabbed?.idx === i;
        const searchKey = `${teamIdx}-${i}`;
        const champ = champs[i];
        return (
          <div className="slot" key={role}>
            <span title={role}>{ROLE_EMOJI[role]}</span>
            <div style={{ position: 'relative', flex: 1 }}>
              <div style={{ position: 'relative' }}>
                {champ && champSearch[searchKey] === undefined && (
                  <Image src={championIconPath(champ)} alt={champ} width={18} height={18} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', borderRadius: 3, pointerEvents: 'none', zIndex: 1 }} />
                )}
                <input
                  type="text"
                  placeholder="Champ…"
                  value={champSearch[searchKey] ?? champ}
                  onChange={(e) => setChampSearch(prev => ({ ...prev, [searchKey]: e.target.value }))}
                  onFocus={() => setChampSearch(prev => ({ ...prev, [searchKey]: champ }))}
                  onBlur={() => setTimeout(() => setChampSearch(prev => { const next = { ...prev }; delete next[searchKey]; return next; }), 200)}
                  style={{ width: '100%', paddingLeft: champ && champSearch[searchKey] === undefined ? 32 : undefined, fontSize: 13 }}
                />
              </div>
              {champSearch[searchKey] !== undefined && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, zIndex: 20, maxHeight: 180, overflowY: 'auto' }}>
                  {filteredChampions(searchKey).map(c => (
                    <div key={c.id} style={{ padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                      onMouseDown={() => { setChamps(champs.map((x, j) => j === i ? c.name : x)); setChampSearch(prev => { const next = { ...prev }; delete next[searchKey]; return next; }); }}>
                      <Image src={championIconPath(c.name)} alt={c.name} width={18} height={18} style={{ borderRadius: 3 }} />
                      <span style={{ fontSize: 13 }}>{c.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <select value={team[i]} onChange={(e) => set(team.map((x, j) => (j === i ? e.target.value : x)))} style={{ flex: 1 }}>
              <option value="">{role}…</option>
              <optgroup label={`Can play ${role}`}>{can.map((p) => <option key={p.name} value={p.name}>{p.name}{p.active ? '' : ' (inactive)'} · {Math.round(p.mmr)}</option>)}</optgroup>
              {other.length > 0 && <optgroup label="Other (sets role anyway)">{other.map((p) => <option key={p.name} value={p.name}>{p.name} · {Math.round(p.mmr)}</option>)}</optgroup>}
            </select>
            <button type="button" className={`grab ${isGrabbed ? 'on' : ''}`} onClick={() => handleGrab(teamIdx, i)} title={isGrabbed ? 'Click another slot to swap' : 'Grab to swap'}>⇅</button>
          </div>
        );
      })}
      <div className="muted small">Total MMR: {Math.round(team.reduce((s, n) => s + (byName.get(n)?.mmr ?? 0), 0))}</div>
    </div>
  );

  return (
    <div className="col">
      <div className="row"><label>Date <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <input placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ flex: 1, minWidth: 180 }} /></div>
      <div className="grid g2">{col('Team 1', 'team-blue', t0, setT0, c0, setC0, 0)}{col('Team 2', 'team-red', t1, setT1, c1, setC1, 1)}</div>
      {!admin && <div className="err">You need to <a href="/admin">log in as admin</a> to save games.</div>}
      <div className="row">
        <button className="big blue" disabled={!complete || busy || !admin} onClick={() => save(0)}>{initial?.id ? 'Save — ' : ''}Team 1 won</button>
        <button className="big red" disabled={!complete || busy || !admin} onClick={() => save(1)}>{initial?.id ? 'Save — ' : ''}Team 2 won</button>
      </div>
      {msg && <div className={msg.ok ? 'ok' : 'err'}>{msg.text}</div>}
    </div>
  );
}
