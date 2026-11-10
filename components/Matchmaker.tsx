'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_EMOJI, type Role } from '@/lib/types';
import html2canvas from 'html2canvas';
import LinkIcon from '@mui/icons-material/Link';
import ImageIcon from '@mui/icons-material/Image';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';

interface P { name: string; mmr: number; active: boolean; games: number; recentGames: number; last10: { w: number; l: number } }
interface Side { players: { name: string; mmr: number; role: Role }[]; total: number; synergy: number | null; against: number | null; estimate: number | null }
interface Option { delta: number; a: Side; b: Side }
const pct = (x: number | null) => (x === null ? '—' : (x * 100).toFixed(1) + '%');
const eloTier = (mmr: number) => mmr >= 1400 ? 'elo-high' : mmr >= 1100 ? 'elo-mid' : 'elo-low';
const MAX_DUOS = 2;
type Duo = [string, string];

export default function Matchmaker({ players, admin, initialSelection = [], initialPick = 0, initialDuos = [] }: { players: P[]; admin: boolean; initialSelection?: string[]; initialPick?: number; initialDuos?: Duo[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<string[]>(initialSelection);
  const [duos, setDuos] = useState<Duo[]>(initialDuos);
  const [duoMode, setDuoMode] = useState(false);
  const [pendingDuo, setPendingDuo] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'image' | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [res, setRes] = useState<{ total: number; options: Option[] } | null>(null);
  const [pick, setPick] = useState(initialPick);
  const [err, setErr] = useState(''); const [ok, setOk] = useState<{ msg: string; gameId: number } | null>(null); const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [slideDir, setSlideDir] = useState<'left' | 'right' | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [modalTeams, setModalTeams] = useState<{ a: Side['players']; b: Side['players'] } | null>(null);
  const [grabbed, setGrabbed] = useState<{ team: 0 | 1; idx: number } | null>(null);
  const [swapMode, setSwapMode] = useState(false);
  const [swappedTeams, setSwappedTeams] = useState<{ a: Side['players']; b: Side['players'] } | null>(null);
  const [swappedStats, setSwappedStats] = useState<{ a: { synergy: number | null; against: number | null; estimate: number | null }; b: { synergy: number | null; against: number | null; estimate: number | null } } | null>(null);
  const [inlineGrabbed, setInlineGrabbed] = useState<{ team: 0 | 1; idx: number } | null>(null);

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
  const duoOf = (n: string) => duos.findIndex((d) => d.includes(n));
  const toggle = (n: string) => {
    setRes(null); setOk(null);
    if (sel.includes(n)) { setDuos((ds) => ds.filter((d) => !d.includes(n))); if (pendingDuo === n) setPendingDuo(null); }
    setSel((s) => (s.includes(n) ? s.filter((x) => x !== n) : s.length < 10 ? [...s, n] : s));
  };
  // In duo mode, clicking chips builds a pair (selecting them if needed) instead of toggling selection.
  const pickDuo = (n: string) => {
    if (duoOf(n) !== -1) return;
    if (n === pendingDuo) { setPendingDuo(null); return; }
    if (!sel.includes(n)) { if (sel.length >= 10) return; setSel((s) => [...s, n]); }
    setRes(null); setOk(null);
    if (!pendingDuo) { setPendingDuo(n); return; }
    setDuos((ds) => [...ds, [pendingDuo, n]]);
    setPendingDuo(null); setDuoMode(false);
  };
  const onChip = (n: string) => (duoMode ? pickDuo(n) : toggle(n));
  const removeDuo = (i: number) => { setRes(null); setDuos((ds) => ds.filter((_, j) => j !== i)); };
  const toggleDuoMode = () => { if (!duoMode && duos.length >= MAX_DUOS) return; setDuoMode(!duoMode); setPendingDuo(null); };
  const chipCls = (n: string) => {
    const d = duoOf(n);
    return d !== -1 ? `on duo-${d}` : n === pendingDuo ? `on duo-${duos.length} duo-pending` : sel.includes(n) ? 'on' : '';
  };
  const chip = (p: P, extra = '') => <span key={p.name} className={`chip ${chipCls(p.name)} ${extra}`} onClick={() => onChip(p.name)}>{p.name}<small className={eloTier(p.mmr)}>{Math.round(p.mmr)}</small></span>;
  const selectPick = (i: number) => { if (i === pick) return; setSlideDir(i > pick ? 'right' : 'left'); setPick(i); setAnimKey((k) => k + 1); setSwapMode(false); setSwappedTeams(null); setSwappedStats(null); setInlineGrabbed(null); };

  async function recalcStats(teams: { a: Side['players']; b: Side['players'] }) {
    const r = await fetch('/api/team-stats', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ teamA: teams.a.map(p => p.name), teamB: teams.b.map(p => p.name) }),
    });
    if (r.ok) {
      const stats = await r.json();
      setSwappedStats(stats);
    }
  }

  function toggleSwapMode() {
    if (swapMode && swappedTeams) {
      recalcStats(swappedTeams);
    }
    setSwapMode(!swapMode);
    setInlineGrabbed(null);
  }

  // Load from sessionStorage on mount (if no URL params)
  useEffect(() => {
    if (initialSelection.length > 0) return; // URL params take priority
    try {
      const saved = sessionStorage.getItem('matchmaking-state');
      if (saved) {
        const { selection, results, pickIndex, duos: savedDuos } = JSON.parse(saved);
        if (selection?.length) setSel(selection);
        if (Array.isArray(savedDuos)) setDuos(savedDuos);
        if (results) setRes(results);
        if (typeof pickIndex === 'number') setPick(pickIndex);
      }
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save to sessionStorage when state changes
  useEffect(() => {
    if (sel.length === 0 && !res) return; // Don't save empty state
    try {
      sessionStorage.setItem('matchmaking-state', JSON.stringify({
        selection: sel,
        results: res,
        pickIndex: pick,
        duos,
      }));
    } catch {}
  }, [sel, res, pick, duos]);

  // Auto-generate if loaded with 10 players from URL
  useEffect(() => {
    if (initialSelection.length === 10 && !res) generate(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate(resetPick = true) {
    setBusy(true); setErr(''); setOk(null);
    const r = await fetch('/api/matchmake', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ players: sel, duos }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error); setRes(null); return; }
    setRes(j); if (resetPick) setPick(0);
  }
  function openRecordModal() {
    if (!res) return;
    const o = res.options[pick];
    const teams = swappedTeams || { a: [...o.a.players], b: [...o.b.players] };
    setModalTeams({ a: [...teams.a], b: [...teams.b] });
    setEditMode(false);
    setGrabbed(null);
    setModalOpen(true);
  }

  function handleInlineGrab(team: 0 | 1, idx: number) {
    if (!res) return;
    const o = res.options[pick];
    const teams = swappedTeams || { a: [...o.a.players], b: [...o.b.players] };
    if (!inlineGrabbed) { setInlineGrabbed({ team, idx }); return; }
    const srcTeam = inlineGrabbed.team === 0 ? [...teams.a] : [...teams.b];
    const dstTeam = team === 0 ? [...teams.a] : [...teams.b];
    const srcPlayer = srcTeam[inlineGrabbed.idx];
    const dstPlayer = dstTeam[idx];
    if (inlineGrabbed.team === team) {
      srcTeam[inlineGrabbed.idx] = { ...dstPlayer, role: srcPlayer.role };
      srcTeam[idx] = { ...srcPlayer, role: dstPlayer.role };
      setSwappedTeams(inlineGrabbed.team === 0 ? { a: srcTeam, b: teams.b } : { a: teams.a, b: srcTeam });
    } else {
      srcTeam[inlineGrabbed.idx] = { ...dstPlayer, role: srcPlayer.role };
      dstTeam[idx] = { ...srcPlayer, role: dstPlayer.role };
      setSwappedTeams({ a: inlineGrabbed.team === 0 ? srcTeam : dstTeam, b: inlineGrabbed.team === 1 ? srcTeam : dstTeam });
    }
    setInlineGrabbed(null);
  }

  function handleGrab(team: 0 | 1, idx: number) {
    if (!modalTeams) return;
    if (!grabbed) { setGrabbed({ team, idx }); return; }
    const srcTeam = grabbed.team === 0 ? [...modalTeams.a] : [...modalTeams.b];
    const dstTeam = team === 0 ? [...modalTeams.a] : [...modalTeams.b];
    const srcPlayer = srcTeam[grabbed.idx];
    const dstPlayer = dstTeam[idx];
    if (grabbed.team === team) {
      srcTeam[grabbed.idx] = { ...dstPlayer, role: srcPlayer.role };
      srcTeam[idx] = { ...srcPlayer, role: dstPlayer.role };
      setModalTeams(grabbed.team === 0 ? { a: srcTeam, b: modalTeams.b } : { a: modalTeams.a, b: srcTeam });
    } else {
      srcTeam[grabbed.idx] = { ...dstPlayer, role: srcPlayer.role };
      dstTeam[idx] = { ...srcPlayer, role: dstPlayer.role };
      setModalTeams({ a: grabbed.team === 0 ? srcTeam : dstTeam, b: grabbed.team === 1 ? srcTeam : dstTeam });
    }
    setGrabbed(null);
  }

  async function record(winner: 0 | 1) {
    if (!modalTeams) return; setBusy(true); setErr('');
    const body = { date: new Date().toLocaleDateString('en-CA'), winner, team0: modalTeams.a.map(({ name, role }) => ({ player: name, role })), team1: modalTeams.b.map(({ name, role }) => ({ player: name, role })) };
    const r = await fetch('/api/matches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { setErr(j.error); return; }
    setModalOpen(false); setOk({ msg: `Saved — Team ${winner + 1} won. MMRs updated.`, gameId: j.id }); setRes(null); setSel([]); setDuos([]); try { sessionStorage.removeItem('matchmaking-state'); } catch {} router.refresh();
  }

  function copyLink() {
    const SHIFT = 7;
    const indices = sel.map((n) => players.findIndex((p) => p.name === n));
    const enc = (i: number) => String.fromCharCode(65 + ((i + SHIFT) % 62));
    const duoChars = duos.flat().map((n) => enc(players.findIndex((p) => p.name === n))).join('');
    const encoded = indices.map(enc).join('') + enc(pick) + duoChars;
    const url = `${window.location.origin}/matchmaking?d=${encoded}`;
    navigator.clipboard.writeText(url);
    setCopied('link'); setTimeout(() => setCopied(null), 2000);
  }

  async function copyImage() {
    if (!captureRef.current) return;
    const canvas = await html2canvas(captureRef.current, { backgroundColor: '#0f1115', scale: 2 });
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied('image'); setTimeout(() => setCopied(null), 2000);
    });
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
  const side = (s: Side, label: string, cls: string, teamIdx: 0 | 1, displayPlayers?: Side['players']) => {
    const pList = displayPlayers || s.players;
    const total = displayPlayers ? displayPlayers.reduce((sum, p) => sum + p.mmr, 0) : s.total;
    const stats = swappedStats && displayPlayers ? swappedStats[teamIdx === 0 ? 'a' : 'b'] : { synergy: s.synergy, against: s.against, estimate: s.estimate };
    return (
      <div className={`card ${cls}`}>
        <div className="row" style={{ justifyContent: 'space-between' }}><b>{label}</b><span className="muted">Σ {Math.round(total)} · avg {Math.round(total / 5)}</span></div>
        <table><tbody>{pList.map((p, i) => {
          const pl = players.find((x) => x.name === p.name);
          return (
            <tr key={p.name}>
              <td>{ROLE_EMOJI[p.role]} <span className="muted small">{p.role}</span></td>
              <td><span className="player-hover"><a href={`/players/${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer">{p.name}</a>{duoOf(p.name) !== -1 && <span className={`duo-dot duo-${duoOf(p.name)}`} title={`Duo ${duoOf(p.name) + 1}`} />}{pl && <span className="player-tooltip"><RingChart w={pl.last10.w} l={pl.last10.l} /><span className="muted small">Last 10</span></span>}</span></td>
              <td className="num">{Math.round(p.mmr)}</td>
              {swapMode && <td><button className={`grab ${inlineGrabbed?.team === teamIdx && inlineGrabbed?.idx === i ? 'on' : ''}`} onClick={() => handleInlineGrab(teamIdx, i)}>⇅</button></td>}
            </tr>
          );
        })}</tbody></table>
        {!swapMode && <div className="small muted" style={{ marginTop: 8 }}>Synergy WR {pct(stats.synergy)} · Against WR {pct(stats.against)} · <b style={{ color: 'var(--text)' }}>Est. {pct(stats.estimate)}</b></div>}
      </div>
    );
  };
  const o = res?.options[pick];
  return (
    <div className="col">
      {ok && <div className="success-banner">{ok.msg} <a href={`/games/${ok.gameId}/edit`}>Go to Game</a></div>}
      <div className="row"><span className="input-hint"><input placeholder="Search players…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { if (sel.length === 10 && !busy) { generate(); } else if (q && shown.length > 0) { onChip(shown[0].name); setQ(''); } } }} /><kbd>⏎</kbd></span>
        <div ref={settingsRef} style={{ position: 'relative' }}>
          <button onClick={() => setSettingsOpen(!settingsOpen)} style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }}><SettingsIcon style={{ fontSize: 18 }} /></button>
          {settingsOpen && <div className="settings-popup">
            <div className="settings-row"><span>Show inactive</span><button className={`toggle ${showInactive ? 'on' : ''}`} onClick={() => setShowInactive(!showInactive)}><span className="toggle-knob" /></button></div>
          </div>}
        </div>
        <span className="info-hint">
          <InfoOutlinedIcon style={{ fontSize: 18, color: 'var(--muted)' }} />
          <span className="info-tooltip elo-legend">
            <span className="elo-row"><span className="elo-swatch elo-high" />1400+</span>
            <span className="elo-row"><span className="elo-swatch elo-mid" />1100–1399</span>
            <span className="elo-row"><span className="elo-swatch elo-low" />Below 1100</span>
          </span>
        </span>
        <span style={{ flex: 1 }} /><span style={{ fontSize: 20 }}><b style={{ color: sel.length === 10 ? 'var(--text)' : 'var(--muted)' }}>{sel.length}</b> / 10</span><span style={{ flex: 1 }} /><button className={`duo-btn ${duoMode ? 'on' : ''}`} disabled={!duoMode && duos.length >= MAX_DUOS} onClick={toggleDuoMode} title={duos.length >= MAX_DUOS ? `Max ${MAX_DUOS} duos` : 'Add duo'}><AddIcon style={{ fontSize: 18 }} />Duo</button><button className="clear-btn" onClick={() => { setSel([]); setRes(null); setDuos([]); setDuoMode(false); setPendingDuo(null); }}>Clear</button></div>
      {(duos.length > 0 || duoMode) && <div className="row duo-row">
        {duos.map((d, i) => <span key={i} className={`duo-tag duo-${i}`}>Duo {i + 1}: {d[0]} + {d[1]}<button onClick={() => removeDuo(i)} title="Remove duo"><CloseIcon style={{ fontSize: 14 }} /></button></span>)}
        {duoMode && <span className="muted small">{pendingDuo ? `Pick ${pendingDuo}'s duo partner…` : `Pick two players for Duo ${duos.length + 1}…`}</span>}
      </div>}
      {q ? (
        <div className="chips">{shown.map((p, i) => chip(p, i === 0 ? 'highlight' : ''))}</div>
      ) : (
        <div className="sections">
          {sections.regulars.length > 0 && <div className="section"><span className="section-label">Regulars (Most played in last 30 games)</span><div className="chips chips-grid">{sections.regulars.map((p) => chip(p))}</div></div>}
          {sections.newPlayers.length > 0 && <div className="section"><span className="section-label">New</span><div className="chips">{sections.newPlayers.map((p) => chip(p))}</div></div>}
          {sections.others.length > 0 && <div className="section"><div className="chips">{sections.others.map((p) => chip(p))}</div></div>}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        <button className="generate-btn" disabled={sel.length !== 10 || busy} onClick={() => generate()}>Generate Teams</button>
      </div>
      {err && <div className="err">{err}</div>}
      {res && o && (<div className="results-enter">
        <h2 style={{ margin: '14px 0 0', display: 'flex', alignItems: 'center', gap: 6 }}>Best of {res.total} valid splits <span className="info-hint"><InfoOutlinedIcon style={{ fontSize: 16, color: 'var(--muted)' }} /><span className="info-tooltip" style={{ width: 260, whiteSpace: 'normal' }}>Of 126 ways to split 10 players, only {res.total} passed: each team can fill all 5 roles, no two same-role one-tricks together, and estimated win rates under 56%.</span></span></h2>
        <div className="row">{res.options.map((x, i) => <span key={i} className="option-wrap"><button className={i === pick ? 'primary' : ''} onClick={() => selectPick(i)}>{i + 1}</button><span className="option-tooltip">Δ {Math.round(x.delta)}</span></span>)}
          <span className="info-hint"><InfoOutlinedIcon style={{ fontSize: 16, color: 'var(--muted)' }} /><span className="info-tooltip">Use ← → keys to navigate</span></span>
          <span style={{ flex: 1 }} />
          <button onClick={copyLink}>{copied === 'link' ? 'Copied!' : <><LinkIcon style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }} />Copy Link</>}</button>
          <button onClick={copyImage}>{copied === 'image' ? 'Copied!' : <><ImageIcon style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 4 }} />Copy Image</>}</button>
          <button className={swapMode ? 'primary' : ''} onClick={toggleSwapMode} title="Swap players" style={{ display: 'flex', alignItems: 'center', padding: '8px 10px' }}><SwapHorizIcon style={{ fontSize: 18 }} /></button></div>
        <div ref={captureRef} key={animKey} className={`pick-content ${slideDir === 'left' ? 'slide-left' : slideDir === 'right' ? 'slide-right' : ''}`}>
          <div className="side-pick-banner">{(() => {
            const totalA = swappedTeams?.a ? swappedTeams.a.reduce((sum, p) => sum + p.mmr, 0) : o.a.total;
            const totalB = swappedTeams?.b ? swappedTeams.b.reduce((sum, p) => sum + p.mmr, 0) : o.b.total;
            const delta = Math.abs(totalA - totalB);
            const lowerTeam = totalA < totalB ? '1' : '2';
            return <>Delta is <b>{Math.round(delta)}</b>. Team {lowerTeam} is lower, so <b>Team {lowerTeam}</b> gets to choose side.</>;
          })()}</div>
          <div className="grid g2">{side(o.a, 'Team 1', 'team-blue', 0, swappedTeams?.a)}{side(o.b, 'Team 2', 'team-red', 1, swappedTeams?.b)}</div>
        </div>
        <div className="row action-row">
          <a href="https://drafter.lol" target="_blank" rel="noopener noreferrer" className="btn action-btn draft-btn">Draft<OpenInNewIcon style={{ fontSize: 16, marginLeft: 6 }} /></a>
          <button className="action-btn record-btn" disabled={busy || !admin} onClick={openRecordModal}>Record Game</button>
        </div>
        {!admin && <div className="muted small"><a href="/admin">Log in as admin</a> to record the result.</div>}
      </div>)}
      {modalOpen && modalTeams && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Record Game</h2>
            {!editMode ? (
              <>
                <div className="grid g2" style={{ marginBottom: 16 }}>
                  <div className="card team-blue"><b>Team 1</b><table><tbody>{modalTeams.a.map((p) => <tr key={p.name}><td>{ROLE_EMOJI[p.role]}</td><td>{p.name}</td></tr>)}</tbody></table></div>
                  <div className="card team-red"><b>Team 2</b><table><tbody>{modalTeams.b.map((p) => <tr key={p.name}><td>{ROLE_EMOJI[p.role]}</td><td>{p.name}</td></tr>)}</tbody></table></div>
                </div>
                <p className="muted">Do you want to make any changes to the roles?</p>
                <div className="row" style={{ marginBottom: 16 }}><button onClick={() => setEditMode(true)}>Yes, edit roles</button><button className="primary" onClick={() => setEditMode(false)}>No, continue</button></div>
                {!editMode && <div className="row"><button className="big blue" disabled={busy} onClick={() => record(0)}>Team 1 won</button><button className="big red" disabled={busy} onClick={() => record(1)}>Team 2 won</button></div>}
              </>
            ) : (
              <>
                <div className="grid g2" style={{ marginBottom: 16 }}>
                  <div className="card team-blue"><b>Team 1</b><table><tbody>{modalTeams.a.map((p, i) => <tr key={p.name}><td>{ROLE_EMOJI[p.role]}</td><td>{p.name}</td><td><button className={`grab ${grabbed?.team === 0 && grabbed?.idx === i ? 'on' : ''}`} onClick={() => handleGrab(0, i)}>⇅</button></td></tr>)}</tbody></table></div>
                  <div className="card team-red"><b>Team 2</b><table><tbody>{modalTeams.b.map((p, i) => <tr key={p.name}><td>{ROLE_EMOJI[p.role]}</td><td>{p.name}</td><td><button className={`grab ${grabbed?.team === 1 && grabbed?.idx === i ? 'on' : ''}`} onClick={() => handleGrab(1, i)}>⇅</button></td></tr>)}</tbody></table></div>
                </div>
                <p className="muted small">To replace a player entirely, use the <a href="/games">Edit Game</a> screen after recording.</p>
                <div className="row" style={{ marginBottom: 16 }}><button onClick={() => { setEditMode(false); setGrabbed(null); }}>Done editing</button></div>
                <div className="row"><button className="big blue" disabled={busy} onClick={() => record(0)}>Team 1 won</button><button className="big red" disabled={busy} onClick={() => record(1)}>Team 2 won</button></div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
