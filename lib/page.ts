import { init } from './api';
import { getLines, getPlayers } from './data';
export async function load() { await init(); const [players, lines] = await Promise.all([getPlayers(), getLines()]); return { players, lines }; }
export const pct = (x: number | null | undefined, d = 1) => (x == null ? '—' : (x * 100).toFixed(d) + '%');
