import { handler } from '@/lib/api';
import { updateMatch, deleteMatch } from '@/lib/data';
export const PUT = handler(async (req, { params }) => { await updateMatch(Number((await params).id), await req.json()); }, { admin: true });
export const DELETE = handler(async (_req, { params }) => { await deleteMatch(Number((await params).id)); }, { admin: true });
