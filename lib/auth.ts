import { cookies } from 'next/headers';
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'cwr_admin';
const prod = () => process.env.NODE_ENV === 'production';
const secret = () => process.env.SESSION_SECRET ?? process.env.ADMIN_PASSWORD ?? (prod() ? '' : 'dev-secret');
const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('hex');

export function checkPassword(pw: string): boolean {
  const want = process.env.ADMIN_PASSWORD ?? (prod() ? '' : 'admin'); // dev default only; production requires ADMIN_PASSWORD
  if (!want) return false;
  const a = Buffer.from(pw), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function setAdminCookie() {
  const exp = String(Date.now() + 30 * 864e5);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 30 * 86400 });
}
export async function clearAdminCookie() { (await cookies()).delete(COOKIE); }
export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value; if (!v || !secret()) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const want = sign(exp);
  return sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want));
}
