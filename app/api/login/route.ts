import { handler } from '@/lib/api';
import { checkPassword, setAdminCookie } from '@/lib/auth';
export const POST = handler(async (req) => {
  const { password } = await req.json();
  if (!checkPassword(String(password ?? ''))) throw new Error('Wrong password');
  await setAdminCookie();
});
