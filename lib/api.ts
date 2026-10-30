import { NextResponse } from 'next/server';
import { isAdmin } from './auth';
import { ensureSchema } from './db';

let ready: Promise<void> | null = null;
export const init = () => (ready ??= ensureSchema());

/** Wrap a route handler: ensures schema, optionally requires admin, and turns thrown errors into JSON 400s. */
export function handler(fn: (req: Request, ctx: any) => Promise<unknown>, opts: { admin?: boolean } = {}) {
  return async (req: Request, ctx: any) => {
    try {
      await init();
      if (opts.admin && !(await isAdmin())) return NextResponse.json({ error: 'Admin login required' }, { status: 401 });
      return NextResponse.json((await fn(req, ctx)) ?? { ok: true });
    } catch (e: any) {
      return NextResponse.json({ error: e?.message ?? 'Something went wrong' }, { status: 400 });
    }
  };
}
