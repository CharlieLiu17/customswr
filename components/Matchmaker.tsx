'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_EMOJI, type Role } from '@/lib/types';
import LinkIcon from '@mui/icons-material/Link';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

interface P { name: string; mmr: number; active: boolean; games: number; recentGames: number; last10: { w: number; l: number } }
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
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    if (settingsOpen) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [settingsOpen]);

  useEffect(() => {
    if (!res) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && pick > 0) selectPick(pick - 1);
      if (e.key === 'ArrowRight' && pick < res.options.length - 1) selectPick(pick + 1);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  });
  const filtered = useMemo(() => players.filter((p) => (showInactive || p.active || sel.includes(p.name)) && p.name.toLowerCase().includes(q.toLowerCase())), [players, q, showInactive, sel]);
  const sections = useMemo(() => {
    const regularNames = new Set(players.slice().sort((a, b) => b.recentGames - a.recentGames).slice(0, 12).filter((p) => p.recentGames > 0).map((p) => p.name));
    const regulars = filtered.filter((p) => regularNames.has(p.name)).sort((a, b) => b.recentGames - a.recentGames);
    const newPlayers = filtered.filter((p) => p.games === 0 && !regularNames.has(p.name));
    const others = filtered.filter((p) => p.games > 0 && !regularNames.has(p.name)).sort((a, b) => b.recentGames - a.recentGames);
    return { regulars, newPlayers, others };
  }, [players, filtered]);
  const shown = useMemo(() => [...sections.regulars, ...sections.newPlayers, ...sections.others], [sections]);
  const toggle = (n: string) => { setRes(null); setOk(null); setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : s.length < 10 ? [...s, n] : s)); };
  const selectPick = (i: number) => { if (i === pick) return; setSlideDir(i > pick ? 'right' : 'left'); setPick(i); setAnimKey((k) => k + 1); };

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
    const SHIFT = 7;
    const indices = sel.map((n) => players.findIndex((p) => p.name === n));
    const encoded = indices.map((i) => String.fromCharCode(65 + ((i + SHIFT) % 62))).join('') + String.fromCharCode(65 + ((pick + SHIFT) % 62));
    const url = `${window.location.origin}/matchmaking?d=${encoded}`;
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

  const RingChart = ({ w, l }: { w: number; l: number }) => {
    const total = w + l || 1;
    const winPct = w / total;
    const r = 18, cx = 24, cy = 24, stroke = 6;
    const circ = 2 * Math.PI * r;
    const winDash = circ * winPct, lossDash = circ * (1 - winPct);
    return (
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--red)" strokeWidth={stroke} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--green)" strokeWidth={stroke}
          strokeDasharray={`${winDash} ${lossDash}`} strokeDashoffset={circ / 4} />
        <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--text)" fontSize="11" fontWeight="600">{w}-{l}</text>
      </svg>
    );
  };
  const side = (s: Side, label: string, cls: string) => (
    <div className={`card ${cls}`}>
      <div className="row" style={{ justifyContent: 'space-between' }}><b>{label}</b><span className="muted">Σ {Math.round(s.total)} · avg {Math.round(s.total / 5)}</span></div>
      <table><tbody>{s.players.map((p) => {
        const pl = players.find((x) => x.name === p.name);
        return (
          <tr key={p.name}>
            <td>{ROLE_EMOJI[p.role]} <span className="muted small">{p.role}</span></td>
            <td><span className="player-hover"><a href={`/players/${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer">{p.name}</a>{pl && <span className="player-tooltip"><RingChart w={pl.last10.w} l={pl.last10.l} /><span className="muted small">Last 10</span></span>}</span></td>
            <td className="num">{Math.round(p.mmr)}</td>
          </tr>
        );
      })}</tbody></table>
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
        <span style={{ flex: 1 }} /><span style={{ fontSize: 20 }}><b style={{ color: sel.length === 10 ? 'var(--text)' : 'var(--muted)' }}>{sel.length}</b> / 10</span><span style={{ flex: 1 }} /><button className="clear-btn" onClick={() => { setSel([]); setRes(null); }}>Clear</button></div>
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
        <button className="generate-btn" disabled={sel.length !== 10 || busy} onClick={() => generate()}>Generate Teams</button>
      </div>
      {err && <div className="err">{err}</div>}{ok && <div className="ok">{ok.msg} <a href={`/games/${ok.gameId}/edit`}>View/Edit game</a></div>}
      {res && o && (<div className="results-enter">
        <h2 style={{ margin: '14px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>Best of {res.total} valid splits <span className="info-hint"><InfoOutlinedIcon style={{ fontSize: 16, color: 'var(--muted)' }} /><span className="info-tooltip" style={{ width: 260, whiteSpace: 'normal' }}>Of 126 ways to split 10 players, only {res.total} passed: each team can fill all 5 roles, no two same-role one-tricks together, and estimated win rates under 56%.</span></span></h2>
        <div className="row">{res.options.map((x, i) => <span key={i} className="option-wrap"><button className={i === pick ? 'primary' : ''} onClick={() => selectPick(i)}>{i + 1}</button><span className="option-tooltip">Δ {Math.round(x.delta)}</span></span>)}
          <span className="info-hint"><InfoOutlinedIcon style={{ fontSize: 16, color: 'var(--muted)' }} /><span className="info-tooltip">Use ← → keys to navigate</span></span>
          <span style={{ flex: 1 }} />
          <button onClick={copyLink}>{copied === 'link' ? 'Copied!' : <><LinkIcon style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }} />Copy Link</>}</button>
          <button onClick={copyText}>{copied === 'text' ? 'Copied!' : <><ContentCopyIcon style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }} />Copy Text</>}</button></div>
        <div key={animKey} className={`pick-content ${slideDir === 'left' ? 'slide-left' : slideDir === 'right' ? 'slide-right' : ''}`}>
          <div className="side-pick-banner">Delta is <b>{Math.round(o.delta)}</b>. Team {o.a.total < o.b.total ? '1' : '2'} is lower, so <b>Team {o.a.total < o.b.total ? '1' : '2'}</b> gets to choose side.</div>
          <div className="grid g2">{side(o.a, 'Team 1', 'team-blue')}{side(o.b, 'Team 2', 'team-red')}</div>
        </div>
        <a href="https://drafter.lol" target="_blank" rel="noopener noreferrer" className="btn draft-btn">Draft<OpenInNewIcon style={{ fontSize: 16, marginLeft: 6 }} /></a>
        <div className="row"><button className="big blue" disabled={busy || !admin} onClick={() => record(0)}>Team 1 won</button><button className="big red" disabled={busy || !admin} onClick={() => record(1)}>Team 2 won</button></div>
        {!admin && <div className="muted small"><a href="/admin">Log in as admin</a> to record the result.</div>}
      </div>)}
    </div>
  );
}
