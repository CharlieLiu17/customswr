import { handler } from '@/lib/api';
import { clearAdminCookie } from '@/lib/auth';
export const POST = handler(async () => { await clearAdminCookie(); });
