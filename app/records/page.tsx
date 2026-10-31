import Link from 'next/link';
import { load, pct } from '@/lib/page';
import { summarize } from '@/lib/stats';
import { ROLES, ROLE_EMOJI } from '@/lib/types';
import RecordsSettings from '@/components/RecordsSettings';

export const dynamic = 'force-dynamic';
const SORTS = { mmr: 'MMR', wr: 'WR%', games: 'Games', wins: 'Wins', losses: 'Losses', fill: 'Fill', name: 'Name' } as const;

export default async function Records({ searchParams }: { searchParams: Promise<{ sort?: string; dir?: string; all?: string }> }) {
  const sp = await searchParams;
  const sort = (sp.sort && sp.sort in SORTS ? sp.sort : 'mmr') as keyof typeof SORTS;
  const dir = sp.dir === 'asc' ? 'asc' : 'desc';
  const { players, lines } = await load();
  const sum = summarize(lines);
  const rows = players.filter((p) => p.active).map((p) => ({ p, s: sum.get(p.name) })).filter((r) => sp.all || (r.s && r.s.games > 0));
  const key = (r: (typeof rows)[number]) => (sort === 'mmr' ? r.p.mmr : sort === 'wr' ? (r.s?.wr ?? -1) : sort === 'games' ? (r.s?.games ?? 0) : sort === 'wins' ? (r.s?.wins ?? 0) : sort === 'losses' ? (r.s?.losses ?? 0) : sort === 'fill' ? (r.s?.fill ?? -1) : r.p.name.toLowerCase());
  const cmp = dir === 'desc' ? (a: any, b: any) => (key(a) > key(b) ? -1 : key(a) < key(b) ? 1 : 0) : (a: any, b: any) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0);
  rows.sort(cmp);
  const topMmr = Math.max(...rows.map((r) => r.p.mmr));
  const total = new Set(lines.map((l) => l.match_id)).size;
  const th = (k: keyof typeof SORTS, cls = 'num') => {
    const nextDir = sort === k && dir === 'desc' ? 'asc' : 'desc';
    return <th className={cls}><Link href={`/records?sort=${k}&dir=${nextDir}${sp.all ? '&all=1' : ''}`} style={{ color: sort === k ? 'var(--text)' : undefined }}>{SORTS[k]}{sort === k ? (dir === 'desc' ? ' ↓' : ' ↑') : ''}</Link></th>;
  };
  return (<>
    <h1>Records</h1>
    <div className="row" style={{ marginBottom: 8 }}><span className="muted">{total} games · {rows.length} players</span><span style={{ flex: 1 }} /><RecordsSettings sort={sort} showAll={!!sp.all} /></div>
    <div className="card scroll"><table>
      <thead><tr><th>#</th>{th('name', '')}<th>Plays</th>{th('mmr')}{th('wins')}{th('losses')}{th('wr')}{th('games')}{th('fill')}</tr></thead>
      <tbody>{rows.map(({ p, s }, i) => (
        <tr key={p.id}>
          <td className="muted">{i + 1}</td>
          <td><Link href={`/players/${encodeURIComponent(p.name)}`}>{p.name}</Link>{p.mmr === topMmr && ' 👑'}{p.one_trick_role && <span className="pill" style={{ marginLeft: 6 }}>OTP {ROLE_EMOJI[p.one_trick_role]}</span>}</td>
          <td>{ROLES.filter((r) => p.playable_roles.includes(r)).map((r) => ROLE_EMOJI[r]).join('')}</td>
          <td className="num"><b>{Math.round(p.mmr)}</b></td><td className="num W">{s?.wins ?? 0}</td><td className="num L">{s?.losses ?? 0}</td>
          <td className="num">{pct(s?.wr)}</td><td className="num">{s?.games ?? 0}</td><td className="num">{pct(s?.fill, 0)}</td>
        </tr>))}</tbody>
    </table></div>
  </>);
}
