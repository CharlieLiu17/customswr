import Link from 'next/link';
import { load } from '@/lib/page';
import { isAdmin } from '@/lib/auth';
import { ROLES, ROLE_EMOJI } from '@/lib/types';
import DeleteGame from '@/components/DeleteGame';

export const dynamic = 'force-dynamic';
const PER = 25;

export default async function Games({ searchParams }: { searchParams: Promise<{ page?: string; player?: string }> }) {
  const sp = await searchParams; const page = Math.max(1, Number(sp.page) || 1);
  const { lines } = await load(); const admin = await isAdmin();
  const by = new Map<number, typeof lines>(); for (const l of lines) (by.get(l.match_id) ?? by.set(l.match_id, []).get(l.match_id)!).push(l);
  let games = [...by.values()].sort((a, b) => b[0].seq - a[0].seq);
  if (sp.player) games = games.filter((g) => g.some((l) => l.player === sp.player));
  const pages = Math.max(1, Math.ceil(games.length / PER));
  const q = (n: number) => `/games?page=${n}${sp.player ? `&player=${encodeURIComponent(sp.player)}` : ''}`;
  return (<>
    <h1>Games {sp.player && <span className="pill">{sp.player} <Link href="/games">×</Link></span>}</h1>
    <p className="muted">{games.length} games, newest first. Page {page}/{pages}.</p>
    <div className="col">{games.slice((page - 1) * PER, page * PER).map((g) => {
      const winners = g.filter((l) => l.result === 'W').sort((a, b) => ROLES.indexOf(a.role ?? 'Top') - ROLES.indexOf(b.role ?? 'Top'));
      const losers = g.filter((l) => l.result === 'L').sort((a, b) => ROLES.indexOf(a.role ?? 'Top') - ROLES.indexOf(b.role ?? 'Top'));
      return (<div className="card" key={g[0].match_id}>
        <div className="row" style={{ justifyContent: 'space-between' }}><span><b>#{g[0].seq}</b> <span className="muted">{g[0].date}</span> {g[0].incomplete && <span className="pill warn" title="The sheet has fewer than 5 wins and 5 losses recorded for this game">incomplete</span>}</span>
          {admin && <span className="row"><Link className="btn" href={`/games/${g[0].match_id}/edit`}>Edit</Link><DeleteGame id={g[0].match_id} /></span>}</div>
        <table className="game-table"><tbody>
          <tr><td className="W">W</td>{winners.map((l) => <td key={l.player}><span className="muted">{l.role ? ROLE_EMOJI[l.role] : ''}</span> <Link href={`/players/${encodeURIComponent(l.player)}`}>{l.player}</Link></td>)}</tr>
          <tr><td className="L">L</td>{losers.map((l) => <td key={l.player}><span className="muted">{l.role ? ROLE_EMOJI[l.role] : ''}</span> <Link href={`/players/${encodeURIComponent(l.player)}`}>{l.player}</Link></td>)}</tr>
        </tbody></table></div>);
    })}</div>
    <div className="row" style={{ marginTop: 14 }}>{page > 1 && <Link className="btn" href={q(page - 1)}>← Newer</Link>}{page < pages && <Link className="btn" href={q(page + 1)}>Older →</Link>}</div>
  </>);
}
