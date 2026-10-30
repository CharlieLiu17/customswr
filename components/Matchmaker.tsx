'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_EMOJI, type Role } from '@/lib/types';

interface P { name: string; mmr: number; active: boolean; games: number; recentGames: number }
interface Side { players: { name: string; mmr: number; role: Role }[]; total: number; synergy: number | null; against: number | null; estimate: number | null }
interface Option { delta: number; a: Side; b: Side }
const pct = (x: number | null) => (x === null ? '—' : (x * 100).toFixed(1) + '%');
const eloTier = (mmr: number) => mmr >= 1400 ? 'elo-high' : mmr >= 1100 ? 'elo-mid' : 'elo-low';

export default function Matchmaker({ players, admin }: { players: P[]; admin: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>([]);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [res, setRes] = useState<{ total: number; options: Option[] } | null>(null);
  const [pick, setPick] = useState(0);
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false);
  const filtered = useMemo(() => players.filter((p) => (showInactive || p.active || sel.includes(p.name)) && p.name.toLowerCase().includes(q.toLowerCase())), [players, q, showInactive, sel]);
  const sections = useMemo(() => {
    const regularNames = new Set(players.slice().sort((a, b) => b.recentGames - a.recentGames).slice(0, 10).filter((p) => p.recentGames > 0).map((p) => p.name));
    const regulars = filtered.filter((p) => regularNames.has(p.name)).sort((a, b) => b.recentGames - a.recentGames);
    const newPlayers = filtered.filter((p) => p.games === 0 && !regularNames.has(p.name));
    const others = filtered.filter((p) => p.games > 0 && !regularNames.has(p.name)).sort((a, b) => b.games - a.games);
    return { regulars, newPlayers, others };
  }, [players, filtered]);
  const shown = useMemo(() => [...sections.regulars, ...sections.newPlayers, ...sections.others], [sections]);
  const toggle = (n: string) => { setRes(null); setOk(''); setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : s.length < 10 ? [...s, n] : s)); };

  async function generate() {
    setBusy(true); setErr(''); setOk('');
    const r = await fetch('/api/matchmake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ players: sel }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error); setRes(null); return; }
    setRes(j); setPick(0);
  }
  async function record(winner: 0 | 1) {
    if (!res) return; const o = res.options[pick]; setBusy(true); setErr('');
    const body = { date: new Date().toLocaleDateString('en-CA'), winner, team0: o.a.players.map(({ name, role }) => ({ player: name, role })), team1: o.b.players.map(({ name, role }) => ({ player: name, role })) };
    const r = await fetch('/api/matches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error); return; }
    setOk(`Saved — ${winner === 0 ? 'Blue' : 'Red'} won. MMRs updated.`); setRes(null); setSel([]); router.refresh();
  }
  const side = (s: Side, label: string, cls: string) => (
    <div className={`card ${cls}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}><b>{label}</b><span className="muted">Σ {Math.round(s.total)} · avg {Math.round(s.total / 5)}</span></div>
      <table><tbody>{s.players.map((p) => <tr key={p.name}><td>{ROLE_EMOJI[p.role]} <span className="muted small">{p.role}</span></td><td>{p.name}</td><td className="num">{Math.round(p.mmr)}</td></tr>)}</tbody></table>
      <div className="small muted" style={{ marginTop: 8 }}>Synergy WR {pct(s.synergy)} · Against WR {pct(s.against)} · <b style={{ color: 'var(--text)' }}>Est. {pct(s.estimate)}</b></div>
    </div>
  );
  const o = res?.options[pick];
  return (
    <div className="col">
      <div className="row"><span className="input-hint"><input placeholder="Search players…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { if (sel.length === 10 && !busy) { generate(); } else if (q && shown.length > 0) { toggle(shown[0].name); setQ(''); } } }} /><kbd>⏎</kbd></span>
        <label className="small muted"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> show inactive</label>
        <span style={{ flex: 1 }} /><b>{sel.length}/10</b><button onClick={() => { setSel([]); setRes(null); }}>Clear</button>
        <button className="primary" disabled={sel.length !== 10 || busy} onClick={generate}>Generate teams</button></div>
      {q ? (
        <div className="chips">{shown.map((p, i) => <span key={p.name} className={`chip ${sel.includes(p.name) ? 'on' : ''} ${i === 0 ? 'highlight' : ''}`} onClick={() => toggle(p.name)}>{p.name}<small className={eloTier(p.mmr)}>{Math.round(p.mmr)}</small></span>)}</div>
      ) : (
        <div className="sections">
          {sections.regulars.length > 0 && <div className="section"><span className="section-label">Regulars</span><div className="chips">{sections.regulars.map((p) => <span key={p.name} className={`chip ${sel.includes(p.name) ? 'on' : ''}`} onClick={() => toggle(p.name)}>{p.name}<small className={eloTier(p.mmr)}>{Math.round(p.mmr)}</small></span>)}</div></div>}
          {sections.newPlayers.length > 0 && <div className="section"><span className="section-label">New</span><div className="chips">{sections.newPlayers.map((p) => <span key={p.name} className={`chip ${sel.includes(p.name) ? 'on' : ''}`} onClick={() => toggle(p.name)}>{p.name}<small className={eloTier(p.mmr)}>{Math.round(p.mmr)}</small></span>)}</div></div>}
          {sections.others.length > 0 && <div className="section"><div className="chips">{sections.others.map((p) => <span key={p.name} className={`chip ${sel.includes(p.name) ? 'on' : ''}`} onClick={() => toggle(p.name)}>{p.name}<small className={eloTier(p.mmr)}>{Math.round(p.mmr)}</small></span>)}</div></div>}
        </div>
      )}
      {err && <div className="err">{err}</div>}{ok && <div className="ok">{ok}</div>}
      {res && o && (<>
        <h2 style={{ margin: '14px 0 0' }}>Best of {res.total} valid splits</h2>
        <div className="row">{res.options.map((x, i) => <button key={i} className={i === pick ? 'primary' : ''} onClick={() => setPick(i)}>#{i + 1} · Δ{Math.round(x.delta)}</button>)}</div>
        <div className="grid g2">{side(o.a, '🔵 Blue', 'team-blue')}{side(o.b, '🔴 Red', 'team-red')}</div>
        <div className="muted small">MMR gap {Math.round(o.delta)}. Estimates average the teammates' historical pairwise WR and each player's WR versus the other team's players.</div>
        <div className="row"><button className="big blue" disabled={busy || !admin} onClick={() => record(0)}>Blue won</button><button className="big red" disabled={busy || !admin} onClick={() => record(1)}>Red won</button></div>
        {!admin && <div className="muted small"><a href="/admin">Log in as admin</a> to record the result.</div>}
      </>)}
    </div>
  );
}
