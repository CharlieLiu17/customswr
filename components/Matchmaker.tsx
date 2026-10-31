'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_EMOJI, type Role } from '@/lib/types';
import LinkIcon from '@mui/icons-material/Link';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';

interface P { name: string; mmr: number; active: boolean; games: number; recentGames: number }
interface Side { players: { name: string; mmr: number; role: Role }[]; total: number; synergy: number | null; against: number | null; estimate: number | null }
interface Option { delta: number; a: Side; b: Side }
const pct = (x: number | null) => (x === null ? '—' : (x * 100).toFixed(1) + '%');
const eloTier = (mmr: number) => mmr >= 1400 ? 'elo-high' : mmr >= 1100 ? 'elo-mid' : 'elo-low';

export default function Matchmaker({ players, admin, initialSelection = [], initialPick = 0 }: { players: P[]; admin: boolean; initialSelection?: string[]; initialPick?: number }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(initialSelection);
  const [copied, setCopied] = useState<'link' | 'text' | null>(null);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [res, setRes] = useState<{ total: number; options: Option[] } | null>(null);
  const [pick, setPick] = useState(initialPick);
  const [err, setErr] = useState(''); const [ok, setOk] = useState<{ msg: string; gameId: number } | null>(null); const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    if (settingsOpen) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [settingsOpen]);
  const filtered = useMemo(() => players.filter((p) => (showInactive || p.active || sel.includes(p.name)) && p.name.toLowerCase().includes(q.toLowerCase())), [players, q, showInactive, sel]);
  const sections = useMemo(() => {
    const regularNames = new Set(players.slice().sort((a, b) => b.recentGames - a.recentGames).slice(0, 12).filter((p) => p.recentGames > 0).map((p) => p.name));
    const regulars = filtered.filter((p) => regularNames.has(p.name)).sort((a, b) => b.recentGames - a.recentGames);
    const newPlayers = filtered.filter((p) => p.games === 0 && !regularNames.has(p.name));
    const others = filtered.filter((p) => p.games > 0 && !regularNames.has(p.name)).sort((a, b) => b.games - a.games);
    return { regulars, newPlayers, others };
  }, [players, filtered]);
  const shown = useMemo(() => [...sections.regulars, ...sections.newPlayers, ...sections.others], [sections]);
  const toggle = (n: string) => { setRes(null); setOk(null); setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : s.length < 10 ? [...s, n] : s)); };

  // Auto-generate if loaded with 10 players from URL
  useEffect(() => {
    if (initialSelection.length === 10 && !res) generate(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate(resetPick = true) {
    setBusy(true); setErr(''); setOk(null);
    const r = await fetch('/api/matchmake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ players: sel }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error); setRes(null); return; }
    setRes(j); if (resetPick) setPick(0);
  }
  async function record(winner: 0 | 1) {
    if (!res) return; const o = res.options[pick]; setBusy(true); setErr('');
    const body = { date: new Date().toLocaleDateString('en-CA'), winner, team0: o.a.players.map(({ name, role }) => ({ player: name, role })), team1: o.b.players.map(({ name, role }) => ({ player: name, role })) };
    const r = await fetch('/api/matches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error); return; }
    setOk({ msg: `Saved — Team ${winner + 1} won. MMRs updated.`, gameId: j.id }); setRes(null); setSel([]); router.refresh();
  }

  function copyLink() {
    const url = `${window.location.origin}/matchmaking?p=${sel.join(',')}&m=${pick}`;
    navigator.clipboard.writeText(url);
    setCopied('link'); setTimeout(() => setCopied(null), 2000);
  }

  function copyText() {
    if (!res) return;
    const o = res.options[pick];
    const formatTeam = (side: Side, num: number) =>
      `**Team ${num}** (${Math.round(side.total)} MMR)\n` +
      side.players.map((p) => `${ROLE_EMOJI[p.role]} ${p.name}`).join('\n');
    const text = `**Customs Match**\n\n${formatTeam(o.a, 1)}\n\n${formatTeam(o.b, 2)}\n\nMMR Gap: ${Math.round(o.delta)}`;
    navigator.clipboard.writeText(text);
    setCopied('text'); setTimeout(() => setCopied(null), 2000);
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
        <div ref={settingsRef} style={{ position: 'relative' }}>
          <button onClick={() => setSettingsOpen(!settingsOpen)} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }}><SettingsIcon style={{ fontSize: 18 }} /></button>
          {settingsOpen && <div className="settings-popup">
            <div className="settings-row"><span>Show inactive</span><button className={`toggle ${showInactive ? 'on' : ''}`} onClick={() => setShowInactive(!showInactive)}><span className="toggle-knob" /></button></div>
          </div>}
        </div>
        <span style={{ flex: 1 }} /><b>{sel.length}/10</b><button onClick={() => { setSel([]); setRes(null); }}>Clear</button></div>
      {q ? (
        <div className="chips">{shown.map((p, i) => <span key={p.name} className={`chip ${sel.includes(p.name) ? 'on' : ''} ${i === 0 ? 'highlight' : ''}`} onClick={() => toggle(p.name)}>{p.name}<small className={eloTier(p.mmr)}>{Math.round(p.mmr)}</small></span>)}</div>
      ) : (
        <div className="sections">
          {sections.regulars.length > 0 && <div className="section"><span className="section-label">Regulars (Most played in last 30 games)</span><div className="chips chips-grid">{sections.regulars.map((p) => <span key={p.name} className={`chip ${sel.includes(p.name) ? 'on' : ''}`} onClick={() => toggle(p.name)}>{p.name}<small className={eloTier(p.mmr)}>{Math.round(p.mmr)}</small></span>)}</div></div>}
          {sections.newPlayers.length > 0 && <div className="section"><span className="section-label">New</span><div className="chips">{sections.newPlayers.map((p) => <span key={p.name} className={`chip ${sel.includes(p.name) ? 'on' : ''}`} onClick={() => toggle(p.name)}>{p.name}<small className={eloTier(p.mmr)}>{Math.round(p.mmr)}</small></span>)}</div></div>}
          {sections.others.length > 0 && <div className="section"><div className="chips">{sections.others.map((p) => <span key={p.name} className={`chip ${sel.includes(p.name) ? 'on' : ''}`} onClick={() => toggle(p.name)}>{p.name}<small className={eloTier(p.mmr)}>{Math.round(p.mmr)}</small></span>)}</div></div>}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <button className="generate-btn" disabled={sel.length !== 10 || busy} onClick={() => generate()}>Generate teams</button>
      </div>
      {err && <div className="err">{err}</div>}{ok && <div className="ok">{ok.msg} <a href={`/games/${ok.gameId}/edit`}>View/Edit game</a></div>}
      {res && o && (<>
        <h2 style={{ margin: '14px 0 0' }}>Best of {res.total} valid splits</h2>
        <div className="row">{res.options.map((x, i) => <span key={i} className="option-wrap"><button className={i === pick ? 'primary' : ''} onClick={() => setPick(i)}>{i + 1}</button><span className="option-tooltip">Δ {Math.round(x.delta)}</span></span>)}
          <span style={{ flex: 1 }} />
          <button onClick={copyLink}>{copied === 'link' ? 'Copied!' : <><LinkIcon style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }} />Copy Link</>}</button>
          <button onClick={copyText}>{copied === 'text' ? 'Copied!' : <><ContentCopyIcon style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }} />Copy Text</>}</button></div>
        <div className="side-pick-banner">Delta is <b>{Math.round(o.delta)}</b>. Team {o.a.total < o.b.total ? '1' : '2'} is lower, so <b>Team {o.a.total < o.b.total ? '1' : '2'}</b> gets to choose side.</div>
        <div className="grid g2">{side(o.a, 'Team 1', 'team-blue')}{side(o.b, 'Team 2', 'team-red')}</div>
        <a href="https://drafter.lol" target="_blank" rel="noopener noreferrer" className="btn draft-btn">Draft<OpenInNewIcon style={{ fontSize: 16, marginLeft: 6 }} /></a>
        <div className="row"><button className="big blue" disabled={busy || !admin} onClick={() => record(0)}>Team 1 won</button><button className="big red" disabled={busy || !admin} onClick={() => record(1)}>Team 2 won</button></div>
        {!admin && <div className="muted small"><a href="/admin">Log in as admin</a> to record the result.</div>}
      </>)}
    </div>
  );
}
