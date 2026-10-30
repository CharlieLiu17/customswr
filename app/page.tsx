import Link from 'next/link';
import { load, pct } from '@/lib/page';
import { summarize } from '@/lib/stats';
import { ROLES, ROLE_EMOJI } from '@/lib/types';

export const dynamic = 'force-dynamic';
const SORTS = { mmr: 'MMR', wr: 'WR%', games: 'Games', wins: 'Wins', name: 'Name' } as const;

export default async function Records({ searchParams }: { searchParams: Promise<{ sort?: string; all?: string }> }) {
  const sp = await searchParams;
  const sort = (sp.sort && sp.sort in SORTS ? sp.sort : 'mmr') as keyof typeof SORTS;
  const { players, lines } = await load();
  const sum = summarize(lines);
  const rows = players.map((p) => ({ p, s: sum.get(p.name) })).filter((r) => sp.all || (r.s && r.s.games > 0));
  const key = (r: (typeof rows)[number]) => (sort === 'mmr' ? -r.p.mmr : sort === 'wr' ? -(r.s?.wr ?? -1) : sort === 'games' ? -(r.s?.games ?? 0) : sort === 'wins' ? -(r.s?.wins ?? 0) : r.p.name.toLowerCase());
  rows.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  const total = new Set(lines.map((l) => l.match_id)).size;
  const th = (k: keyof typeof SORTS, cls = 'num') => <th className={cls}><Link href={`/?sort=${k}${sp.all ? '&all=1' : ''}`} style={{ color: sort === k ? 'var(--text)' : undefined }}>{SORTS[k]}{sort === k ? ' ↓' : ''}</Link></th>;
  return (<>
    <h1>Records</h1>
    <p className="muted">{total} games · {rows.length} players. Click a column to sort. <Link href={`/?sort=${sort}${sp.all ? '' : '&all=1'}`}>{sp.all ? 'Hide' : 'Show'} players with no games</Link></p>
    <div className="card scroll"><table>
      <thead><tr><th>#</th>{th('name', '')}<th>Plays</th>{th('mmr')}{th('wins')}<th className="num">Losses</th>{th('wr')}{th('games')}<th className="num" title="1 − 2.5·σ(role shares)">Fill</th></tr></thead>
      <tbody>{rows.map(({ p, s }, i) => (
        <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
          <td className="muted">{i + 1}</td>
          <td><Link href={`/players/${encodeURIComponent(p.name)}`}>{p.name}</Link>{p.one_trick_role && <span className="pill" style={{ marginLeft: 6 }}>OTP {ROLE_EMOJI[p.one_trick_role]}</span>}</td>
          <td>{ROLES.filter((r) => p.playable_roles.includes(r)).map((r) => ROLE_EMOJI[r]).join('')}</td>
          <td className="num"><b>{Math.round(p.mmr)}</b></td><td className="num W">{s?.wins ?? 0}</td><td className="num L">{s?.losses ?? 0}</td>
          <td className="num">{pct(s?.wr)}</td><td className="num">{s?.games ?? 0}</td><td className="num">{pct(s?.fill, 0)}</td>
        </tr>))}</tbody>
    </table></div>
  </>);
}
