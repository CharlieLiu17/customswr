'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function Nav({ admin }: { admin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <nav className={open ? 'open' : ''}>
      <div className="nav-container">
        <Link href="/" className="brand"><Image src="/favicon-32x32.png" alt="" width={20} height={20} style={{ marginRight: 6, verticalAlign: 'middle' }} />Customs WR</Link>
        <button className="hamburger" onClick={() => setOpen(!open)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
        <div className="nav-links">
          <Link className="link" href="/records" onClick={() => setOpen(false)}>Records</Link>
          <Link className="link" href="/matchmaking" onClick={() => setOpen(false)}>Matchmaking</Link>
          <Link className="link" href="/new" onClick={() => setOpen(false)}>New Game</Link>
          <Link className="link" href="/games" onClick={() => setOpen(false)}>Games</Link>
          <Link className="link" href="/head-to-head" onClick={() => setOpen(false)}>Head-to-head</Link>
          <Link className="link" href="/matrix" onClick={() => setOpen(false)}>Matrix</Link>
          <span className="spacer" />
          <Link className="link" href="/admin" onClick={() => setOpen(false)}>{admin ? 'Admin ✓' : 'Admin login'}</Link>
        </div>
      </div>
    </nav>
  );
}
