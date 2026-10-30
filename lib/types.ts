export const ROLES = ['Top', 'Jungle', 'Mid', 'Bottom', 'Support'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_EMOJI: Record<Role, string> = { Top: '⚔️', Jungle: '🌳', Mid: '🧙', Bottom: '🏹', Support: '✨' };
export type Result = 'W' | 'L';

export interface PlayerRow {
  id: number; name: string; start_mmr: number; baseline_mmr: number; mmr: number;
  active: boolean; one_trick_role: Role | null; playable_roles: Role[];
}
/** One player's line in one game (flat row joined from matches + match_players). */
export interface GameLine {
  match_id: number; seq: number; date: string; incomplete: boolean;
  player_id: number; player: string; team: 0 | 1; result: Result; role: Role | null;
  mmr_after: number | null;
}
