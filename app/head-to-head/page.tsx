import { load, pct } from '@/lib/page';
import { relations, wr } from '@/lib/stats';
import { ROLE_EMOJI } from '@/lib/types';

export const dynamic = 'force-dynamic';
export default async function H2H({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams; const { players, lines } = await load();
  const rel = relations(lines);
  const w = a && b && a !== b ? rel.with.get(a)?.get(b) : undefined, ag = a && b && a !== b ? rel.against.get(a)?.get(b) : undefined;
  const together = a && b ? lines.filter((l) => l.player === a).flatMap((la) => { const lb = lines.find((x) => x.match_id === la.match_id && x.player === b); return lb ? [{ la, lb }] : []; }).reverse().slice(0, 15) : [];
  const sel = (name: string, v?: string) => <select name={name} defaultValue={v ?? ''}><option value="">Player {name.toUpperCase()}…</option>{players.map((p) => <option key={p.id}>{p.name}</option>)}</select>;
  return (<><h1>Head-to-head</h1>
    <form className="row" style={{ marginBottom: 16 }}>{sel('a', a)}<span className="muted">and</span>{sel('b', b)}<button className="primary">Compare</button></form>
    {a && b && a !== b && (<>
      <div className="grid g2">
        <div className="card"><div className="statlabel">{a} & {b} on the same team</div><div className="stat">{w ? `${w.w}–${w.l}` : '—'}</div><div className="muted">{w ? pct(wr(w.w, w.l)) : 'never teamed'}</div></div>
        <div className="card"><div className="statlabel">{a} against {b}</div><div className="stat">{ag ? `${ag.w}–${ag.l}` : '—'}</div><div className="muted">{ag ? `${pct(wr(ag.w, ag.l))} for ${a} · ${pct(wr(ag.l, ag.w))} for ${b}` : 'never faced'}</div></div>
      </div>
      <h2>Recent games with both</h2>
      <div className="card scroll"><table><thead><tr><th>#</th><th>Date</th><th>{a}</th><th>{b}</th><th>Relation</th><th>{a} result</th></tr></thead><tbody>
        {together.map(({ la, lb }) => <tr key={la.match_id}><td className="muted">{la.seq}</td><td>{la.date}</td><td>{la.role ? ROLE_EMOJI[la.role] : ''}</td><td>{lb.role ? ROLE_EMOJI[lb.role] : ''}</td><td>{la.team === lb.team ? 'teammates' : 'opponents'}</td><td className={la.result}>{la.result}</td></tr>)}</tbody></table></div>
    </>)}
  </>);
}
