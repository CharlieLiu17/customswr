import bundled from '@/data/avatars.json';

/**
 * Where avatar images live. Callers only ever see `avatarUrl()`, so swapping the store
 * (e.g. to S3 / CloudFront once uploads exist) doesn't touch any page code.
 */
export interface AvatarStore { url(key: string): string }

/** Stand-in store: images committed under public/avatars/ and served as static files. */
const repoStore: AvatarStore = { url: (key) => `/avatars/${key}` };

export const avatarStore: AvatarStore = repoStore;

// Keys become part of a URL, so only allow plain file names (no slashes, no `..`).
const KEY_RE = /^[a-z0-9][a-z0-9_-]*\.(png|jpe?g|webp)$/i;
export const isValidAvatarKey = (key: string) => KEY_RE.test(key);

/**
 * Avatar key for a player. Today this comes from data/avatars.json (player name -> file name);
 * when uploads land, read a `players.avatar_key` column first and fall back to this map.
 */
export function avatarKeyFor(playerName: string): string | null {
  const key = (bundled as Record<string, string>)[playerName];
  return key && isValidAvatarKey(key) ? key : null;
}

export function avatarUrl(playerName: string): string | null {
  const key = avatarKeyFor(playerName);
  return key ? avatarStore.url(key) : null;
}
