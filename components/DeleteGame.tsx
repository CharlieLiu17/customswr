'use client';
import { useRouter } from 'next/navigation';
export default function DeleteGame({ id }: { id: number }) {
  const router = useRouter();
  return <button className="danger" onClick={async () => {
    if (!confirm('Delete this game? Everyone\'s MMR after it will be recalculated.')) return;
    const r = await fetch(`/api/matches/${id}`, { method: 'DELETE' }); if (!r.ok) alert((await r.json()).error); router.refresh();
  }}>Delete</button>;
}
