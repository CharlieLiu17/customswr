import { handler } from '@/lib/api';
import { resetBaselines } from '@/lib/data';
export const POST = handler(async () => { await resetBaselines(); }, { admin: true });
