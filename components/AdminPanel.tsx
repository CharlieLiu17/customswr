'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLES, ROLE_EMOJI, type Role } from '@/lib/types';

interface P { id: number; name: string; mmr: number; baseline: number; active: boolean; oneTrick: Role | null; roles: Role[]; igns: string[] }
async function call(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error); return j;
}

export function LoginForm() {
  const router = useRouter(); const [pw, setPw] = useState(''); const [err, setErr] = useState('');
  return (<form className="row" onSubmit={async (e) => { e.preventDefault(); try { await call('/api/login', 'POST', { password: pw }); router.refresh(); } catch (x: any) { setErr(x.message); } }}>
    <input type="password" placeholder="Admin password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus /><button className="primary">Log in</button>{err && <span className="err">{err}</span>}</form>);
}

export default function AdminPanel({ players }: { players: P[] }) {
  const router = useRouter(); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [name, setName] = useState(''); const [mmr, setMmr] = useState('1200'); const [roles, setRoles] = useState<Role[]>([...ROLES]); const [otp, setOtp] = useState<Role | ''>('');
  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); setMsg({ ok: true, t: ok }); router.refresh(); } catch (e: any) { setMsg({ ok: false, t: e.message }); } };
  const toggleRole = (r: Role) => setRoles((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]));
  return (<div className="col">
    {msg && <div className={msg.ok ? 'ok' : 'err'}>{msg.t}</div>}
    <div className="card col"><b>Add player</b>
      <div className="row"><input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} /><label>Starting MMR <input type="number" value={mmr} onChange={(e) => setMmr(e.target.value)} style={{ width: 90 }} /></label></div>
      <div className="row">Playable roles: {ROLES.map((r) => <label key={r} className={`chip ${roles.includes(r) ? 'on' : ''}`}><input type="checkbox" hidden checked={roles.includes(r)} onChange={() => toggleRole(r)} />{ROLE_EMOJI[r]} {r}</label>)}</div>
      <div className="row"><label>One-trick (optional) <select value={otp} onChange={(e) => setOtp(e.target.value as Role | '')}><option value="">none</option>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        <button className="primary" onClick={() => run(async () => { await call('/api/players', 'POST', { name, start_mmr: Number(mmr), playable_roles: roles, one_trick_role: otp || null }); setName(''); }, `Added ${name}`)}>Add player</button></div>
      <div className="muted small">That's all it takes — no new rows, columns or formulas. They show up in Records, matchmaking, and stats immediately.</div></div>
    <div className="card"><b>Players</b>
      <div className="scroll"><table><thead><tr><th className="sticky">Name</th><th>Roles</th><th>Active</th><th className="num">MMR</th><th>IGNs</th></tr></thead><tbody>
        {players.map((p) => <Row key={p.id} p={p} run={run} />)}</tbody></table></div></div>
    <div className="card"><b>New baseline</b>
      <p className="muted small">The rubber-banding (±1 per 60 points away from baseline) is measured from each player's baseline. This sets everyone's baseline to their current MMR for future games — the sheet's "New Baseline" column. Past games are unaffected.</p>
      <button onClick={() => confirm('Set every player\'s baseline to their current MMR?') && run(() => call('/api/admin/baseline', 'POST'), 'Baselines reset')}>Reset baselines to current MMR</button></div>
    <div><button onClick={async () => { await call('/api/logout', 'POST'); router.refresh(); }}>Log out</button></div>
  </div>);
}

function Row({ p, run }: { p: P; run: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [v, setV] = useState(String(Math.round(p.mmr)));
  const [editName, setEditName] = useState(p.name);
  const [editIgns, setEditIgns] = useState(p.igns.join(', '));
  const patch = (b: object, ok: string) => run(() => call(`/api/players/${p.id}`, 'PATCH', b), ok);
  const ignsChanged = editIgns.split(',').map(s => s.trim()).filter(Boolean).sort().join(',') !== p.igns.sort().join(',');
  return (<tr style={{ opacity: p.active ? 1 : 0.55 }}><td className="row sticky"><input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ width: 120 }} /><button disabled={editName.trim() === p.name} onClick={() => patch({ name: editName.trim() }, `Renamed to ${editName.trim()}`)}>Rename</button></td>
    <td>{ROLES.map((r) => <label key={r} title={r} style={{ marginRight: 6, cursor: 'pointer', opacity: p.roles.includes(r) ? 1 : 0.3 }}>
      <input type="checkbox" hidden checked={p.roles.includes(r)} onChange={() => { const next = p.roles.includes(r) ? p.roles.filter((x) => x !== r) : [...p.roles, r]; if (next.length) patch({ playable_roles: next }, `${p.name} roles updated`); }} />{ROLE_EMOJI[r]}</label>)}</td>
    <td><input type="checkbox" checked={p.active} onChange={(e) => patch({ active: e.target.checked }, `${p.name} ${e.target.checked ? 'activated' : 'deactivated'}`)} /></td>
    <td className="row num"><input type="number" value={v} onChange={(e) => setV(e.target.value)} style={{ width: 80 }} />
      <button disabled={Number(v) === Math.round(p.mmr)} onClick={() => run(() => call('/api/admin/adjust', 'POST', { player_id: p.id, mmr: Number(v), note: 'manual' }), `${p.name} MMR set to ${v}`)}>Set</button></td>
    <td className="row"><input type="text" value={editIgns} onChange={(e) => setEditIgns(e.target.value)} placeholder="IGN1, IGN2..." style={{ width: 140 }} /><button disabled={!ignsChanged} onClick={() => patch({ igns: editIgns.split(',').map(s => s.trim()).filter(Boolean) }, `${p.name} IGNs updated`)}>Save</button></td></tr>);
}
