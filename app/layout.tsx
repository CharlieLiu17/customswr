import './globals.css';
import type { ReactNode } from 'react';
import { isAdmin } from '@/lib/auth';
import Nav from '@/components/Nav';

export const metadata = {
  title: 'Customs WR',
  description: 'Custom-game records, matchmaking and stats',
  manifest: '/site.webmanifest',
  icons: {
    icon: [{ url: '/favicon-16x16.png', sizes: '16x16' }, { url: '/favicon-32x32.png', sizes: '32x32' }],
    apple: '/apple-touch-icon.png',
  },
};
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
