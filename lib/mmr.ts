import type { Result } from './types';

export const BASE_GAIN = 15;
export const RUBBER_BAND = 60;

/**
 * Port of the sheet formula:
 *   W: prev + (15 - QUOTIENT(prev - base, 60))
 *   L: prev - (15 + QUOTIENT(prev - base, 60))
 * QUOTIENT truncates toward zero (Math.trunc). Results are clamped at 0 so a streak
 * far from baseline can never turn a win into a loss (or vice versa); the sheet itself
 * would go negative past ~900 points of drift, which never happens in practice.
 */
export function mmrDelta(result: Result, current: number, base: number): number {
  const q = Math.trunc((current - base) / RUBBER_BAND);
  return result === 'W' ? Math.max(0, BASE_GAIN - q) : 0 - Math.max(0, BASE_GAIN + q);
}
export function applyResult(result: Result, current: number, base: number): number {
  return current + mmrDelta(result, current, base);
}
