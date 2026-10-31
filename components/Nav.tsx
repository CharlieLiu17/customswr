'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function Nav({ admin }: { admin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <nav className={open ? 'open' : ''}>
      <Link href="/" className="brand">⚔️ Customs WR</Link>
      <button className="hamburger" onClick={() => setOpen(!open)} aria-label="Toggle menu">
        <span /><span /><span />
      </button>
      <div className="nav-links">
        <Link className="link" href="/records" onClick={() => setOpen(false)}>Records</Link>
        <Link className="link" href="/matchmaking" onClick={() => setOpen(false)}>Matchmaking</Link>
        <Link className="link" href="/new" onClick={() => setOpen(false)}>Log game</Link>
        <Link className="link" href="/games" onClick={() => setOpen(false)}>Games</Link>
        <Link className="link" href="/head-to-head" onClick={() => setOpen(false)}>Head-to-head</Link>
        <Link className="link" href="/matrix" onClick={() => setOpen(false)}>Matrix</Link>
        <span className="spacer" />
        <Link className="link" href="/admin" onClick={() => setOpen(false)}>{admin ? 'Admin ✓' : 'Admin login'}</Link>
      </div>
    </nav>
  );
}
