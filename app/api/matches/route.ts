import { handler } from '@/lib/api';
import { createMatch } from '@/lib/data';
export const POST = handler(async (req) => ({ id: await createMatch(await req.json()) }), { admin: true });
