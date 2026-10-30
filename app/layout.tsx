import './globals.css';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { isAdmin } from '@/lib/auth';

export const metadata = { title: 'Customs WR', description: 'Custom-game records, matchmaking and stats' };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const admin = await isAdmin();
  return (
    <html lang="en"><body>
      <nav>
        <Link href="/" className="brand">⚔️ Customs WR</Link>
        <Link className="link" href="/">Records</Link>
        <Link className="link" href="/matchmaking">Matchmaking</Link>
        <Link className="link" href="/new">Log game</Link>
        <Link className="link" href="/games">Games</Link>
        <Link className="link" href="/head-to-head">Head-to-head</Link>
        <Link className="link" href="/matrix">Matrix</Link>
        <span className="spacer" />
        <Link className="link" href="/admin">{admin ? 'Admin ✓' : 'Admin login'}</Link>
      </nav>
      <main>{children}</main>
    </body></html>
  );
}
