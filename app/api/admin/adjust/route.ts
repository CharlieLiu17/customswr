import { handler } from '@/lib/api';
import { adjustMmr } from '@/lib/data';
export const POST = handler(async (req) => {
  const { player_id, mmr, note } = await req.json();
  if (!Number.isFinite(Number(mmr))) throw new Error('MMR must be a number');
  await adjustMmr(Number(player_id), Number(mmr), note);
}, { admin: true });
