import { handler } from '@/lib/api';
import { createPlayer } from '@/lib/data';
export const POST = handler(async (req) => { const b = await req.json(); await createPlayer({ ...b, start_mmr: Number(b.start_mmr) }); }, { admin: true });
