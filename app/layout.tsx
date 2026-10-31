import './globals.css';
import type { ReactNode } from 'react';
import { isAdmin } from '@/lib/auth';
import Nav from '@/components/Nav';

export const metadata = { title: 'Customs WR', description: 'Custom-game records, matchmaking and stats' };
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const admin = await isAdmin();
  return (
    <html lang="en"><body>
      <Nav admin={admin} />
      <main>{children}</main>
      <footer>Made with ❤️ by Charlie Liu</footer>
    </body></html>
  );
}
