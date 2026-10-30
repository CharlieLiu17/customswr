import Link from 'next/link';
import { load } from '@/lib/page';
import { relations, summarize, wr } from '@/lib/stats';

export const dynamic = 'force-dynamic';
export default async function Matrix({ searchParams }: { searchParams: Promise<{ kind?: string; min?: string }> }) {
  const sp = await searchParams; const kind = sp.kind === 'against' ? 'against' : 'with'; const min = Math.max(1, Number(sp.min) || 20);
  const { lines } = await load(); const sum = summarize(lines), rel = relations(lines);
  const names = [...sum.values()].filter((s) => s.games >= min).sort((a, b) => b.games - a.games).map((s) => s.name);
  const color = (r: number) => { const t = Math.max(-1, Math.min(1, (r - 0.5) / 0.25)); return t >= 0 ? `rgba(62,207,142,${t * 0.65})` : `rgba(255,93,108,${-t * 0.65})`; };
  return (<><h1>{kind === 'with' ? 'Pairwise win rate (as teammates)' : 'Win rate against'}</h1>
    <div className="row" style={{ marginBottom: 12 }}>
      <Link className="btn" href={`/matrix?kind=with&min=${min}`}>With</Link><Link className="btn" href={`/matrix?kind=against&min=${min}`}>Against</Link>
      <span className="muted small">Players with {min}+ games. Cell = row player's WR {kind === 'with' ? 'when on a team with' : 'when facing'} the column player. Hover for W-L.</span>
      {[10, 20, 40].map((m) => <Link key={m} className="btn" href={`/matrix?kind=${kind}&min=${m}`}>{m}+</Link>)}</div>
    <div className="card scroll"><table className="heat"><thead><tr><th />{names.map((n) => <th key={n} style={{ writingMode: 'vertical-rl' }}>{n}</th>)}</tr></thead><tbody>
      {names.map((a) => <tr key={a}><th style={{ textAlign: 'right' }}>{a}</th>{names.map((b) => {
        if (a === b) return <td key={b} className="muted">—</td>;
        const c = (kind === 'with' ? rel.with : rel.against).get(a)?.get(b); const r = c ? wr(c.w, c.l) : null;
        return <td key={b} title={c ? `${a} ${c.w}-${c.l}` : 'no games'} style={{ background: r === null ? undefined : color(r) }}>{r === null ? '' : Math.round(r * 100)}</td>; })}</tr>)}</tbody></table></div></>);
}
