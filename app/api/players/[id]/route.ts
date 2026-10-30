import { handler } from '@/lib/api';
import { updatePlayer } from '@/lib/data';
export const PATCH = handler(async (req, { params }) => { await updatePlayer(Number((await params).id), await req.json()); }, { admin: true });
