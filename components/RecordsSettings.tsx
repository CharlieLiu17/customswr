'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SettingsIcon from '@mui/icons-material/Settings';

export default function RecordsSettings({ sort, showAll }: { sort: string; showAll: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  const toggle = () => {
    router.push(`/records?sort=${sort}${showAll ? '' : '&all=1'}`);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(!open)} style={{ padding: '4px 8px', display: 'flex', alignItems: 'center' }}>
        <SettingsIcon style={{ fontSize: 18 }} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8, padding: 8, zIndex: 20, minWidth: 200 }}>
          <span className={`pill ${showAll ? 'on' : ''}`} onClick={toggle} style={{ cursor: 'pointer' }}>
            {showAll ? '✓ ' : ''}Show players with no games
          </span>
        </div>
      )}
    </div>
  );
}
