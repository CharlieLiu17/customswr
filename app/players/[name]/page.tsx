import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { load, pct } from '@/lib/page';
import { relations, summarize, wr } from '@/lib/stats';
import { ROLES, ROLE_EMOJI } from '@/lib/types';

function championIconPath(champion: string): string {
  const id = champion.replace(/[^a-zA-Z]/g, '').toLowerCase();
  return `/champions/${id}.png`;
}

export const dynamic = 'force-dynamic';
const MIN = 5;

function Spark({ pts }: { pts: number[] }) {
  if (pts.length < 2) return <div className="muted small">Not enough games for a chart.</div>;
  const w = 600, h = 120, min = Math.min(...pts), max = Math.max(...pts), pad = 6;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (w - 2 * pad), y = (v: number) => h - pad - ((v - min) / Math.max(1, max - min)) * (h - 2 * pad);
  return (<svg viewBox={`0 0 ${w} ${h}`} width="100%" height="120" role="img" aria-label="MMR over time">
    <polyline fill="none" stroke="var(--primary)" strokeWidth="2" points={pts.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
    <text x={pad} y={12} fill="var(--muted)" fontSize="11">{Math.round(max)}</text><text x={pad} y={h - 2} fill="var(--muted)" fontSize="11">{Math.round(min)}</text></svg>);
}

export default async function PlayerPage({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const { players, lines } = await load();
  const p = players.find((x) => x.name === name); if (!p) notFound();
  const s = summarize(lines).get(name);
  const rel = relations(lines);
  const list = (m: Map<string, { w: number; l: number }> | undefined) => [...(m ?? [])].map(([n, c]) => ({ n, ...c, g: c.w + c.l, r: wr(c.w, c.l)! })).filter((x) => x.g >= MIN);
  const mate = list(rel.with.get(name)), opp = list(rel.against.get(name));
  const best = (xs: typeof mate) => [...xs].sort((a, b) => b.r - a.r || b.g - a.g).slice(0, 5), worst = (xs: typeof mate) => [...xs].sort((a, b) => a.r - b.r || b.g - a.g).slice(0, 5);
  const mine = lines.filter((l) => l.player === name);
  const series = [p.start_mmr, ...mine.filter((l) => l.mmr_after != null).map((l) => l.mmr_after!)];

  // Champion stats
  const champStats = new Map<string, { w: number; l: number }>();
  for (const l of mine) {
    if (!l.champion) continue;
    const c = champStats.get(l.champion) ?? { w: 0, l: 0 };
    if (l.result === 'W') c.w++; else c.l++;
    champStats.set(l.champion, c);
  }
  const champList = [...champStats.entries()]
    .map(([champ, c]) => ({ champ, ...c, games: c.w + c.l, winrate: wr(c.w, c.l) }))
    .sort((a, b) => b.games - a.games || (b.winrate ?? 0) - (a.winrate ?? 0));
  const tbl = (title: string, xs: typeof mate) => (<div className="card"><b>{title}</b><table><tbody>{xs.length ? xs.map((x) => <tr key={x.n}><td><Link href={`/head-to-head?a=${encodeURIComponent(name)}&b=${encodeURIComponent(x.n)}`}>{x.n}</Link></td><td className="num">{x.w}-{x.l}</td><td className="num">{pct(x.r, 0)}</td></tr>) : <tr><td className="muted">Needs {MIN}+ games together</td></tr>}</tbody></table></div>);
  return (<>
    <h1>{p.name} {p.one_trick_role && <span className="pill">One-trick {ROLE_EMOJI[p.one_trick_role]}</span>} {!p.active && <span className="pill warn">inactive</span>}</h1>
    <div className="grid g3" style={{ marginBottom: 14 }}>
      <div className="card"><div className="stat">{Math.round(p.mmr)}</div><div className="statlabel">MMR (started {Math.round(p.start_mmr)})</div></div>
      <div className="card"><div className="stat">{s?.wins ?? 0}–{s?.losses ?? 0}</div><div className="statlabel">Record · {pct(s?.wr)}</div></div>
      <div className="card"><div className="stat">{pct(s?.fill, 0)}</div><div className="statlabel">Fill score · plays {ROLES.filter((r) => p.playable_roles.includes(r)).map((r) => ROLE_EMOJI[r]).join('')}</div></div>
    </div>
    <div className="card"><b>MMR over time</b><Spark pts={series} /></div>
    <h2>Win rate by role</h2>
    <div className="card scroll"><table><thead><tr><th>Role</th><th className="num">W</th><th className="num">L</th><th className="num">WR</th><th className="num">Share of games</th></tr></thead><tbody>
      {ROLES.map((r) => { const c = s?.byRole[r] ?? { w: 0, l: 0 }, g = c.w + c.l; return <tr key={r}><td>{ROLE_EMOJI[r]} {r}</td><td className="num">{c.w}</td><td className="num">{c.l}</td><td className="num">{pct(wr(c.w, c.l), 0)}</td><td className="num">{s?.games ? pct(g / s.games, 0) : '—'}</td></tr>; })}</tbody></table></div>
    {champList.length > 0 && (<>
      <h2>Champion pool <span className="muted small">({champList.length} played)</span></h2>
      <div className="card scroll"><table><thead><tr><th>Champion</th><th className="num">W</th><th className="num">L</th><th className="num">WR</th><th className="num">Games</th></tr></thead><tbody>
        {champList.map((c) => <tr key={c.champ}><td style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Image src={championIconPath(c.champ)} alt={c.champ} width={20} height={20} style={{ borderRadius: 4 }} />{c.champ}</td><td className="num">{c.w}</td><td className="num">{c.l}</td><td className="num">{pct(c.winrate, 0)}</td><td className="num">{c.games}</td></tr>)}</tbody></table></div>
    </>)}
    <h2>Teammates & opponents <span className="muted small">(min {MIN} games)</span></h2>
    <div className="grid g2">{tbl('Best with', best(mate))}{tbl('Worst with', worst(mate))}{tbl('Best against (kryptonite for them)', best(opp))}{tbl('Worst against (their kryptonites)', worst(opp))}</div>
    <h2>Recent games</h2>
    <div className="card scroll"><table><thead><tr><th>#</th><th>Date</th><th>Role</th><th>Result</th><th className="num">MMR after</th></tr></thead><tbody>
      {[...mine].reverse().slice(0, 20).map((l) => <tr key={l.match_id}><td className="muted">{l.seq}</td><td>{l.date}</td><td>{l.role ? `${ROLE_EMOJI[l.role]} ${l.role}` : '—'}</td><td className={l.result}>{l.result === 'W' ? 'Win' : 'Loss'}</td><td className="num">{l.mmr_after == null ? '—' : Math.round(l.mmr_after)}</td></tr>)}</tbody></table></div>
  </>);
}
