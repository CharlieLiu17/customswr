import { describe, it, expect } from 'vitest';
import { avatarUrl, isValidAvatarKey } from '../lib/avatars';

describe('avatars', () => {
  it('resolves bundled avatars by exact player name', () => {
    expect(avatarUrl('Charlezard')).toBe('/avatars/charlezard.jpg');
    expect(avatarUrl('Nobody')).toBeNull();
  });
  it('only accepts plain image file names as keys', () => {
    expect(isValidAvatarKey('charlezard.jpg')).toBe(true);
    for (const bad of ['../secret.png', 'a/b.png', '.png', 'x.svg', 'x.jpg?y']) expect(isValidAvatarKey(bad)).toBe(false);
  });
});
