import { z } from "zod";
import type { GameKey } from "./game.types.ts";

/**
 * Represents a "safe" user object that excludes sensitive information like
 * the password, suitable for exposing to clients,
 * - `username`: unique username of the user
 * - `display`: A display name
 * - `createdAt`: when this when the user registered.
 */
export interface SafeUserInfo {
  username: string;
  display: string;
  createdAt: Date;
}

/**
 * Profile view information for rendering another user's profile with visibility rules.
 */
export interface ProfileViewInfo {
  username: string;
  display: string;
  createdAt: Date | null;
  areFriends: boolean;
  canViewStats: boolean;
  stats: ProfileStatsInfo | null;
  personalInfoVisibility: ProfileFieldVisibility;
  personalInfo: ProfilePersonalInfo | null;
}

/**
 * Visibility options for profile fields
 */
export type ProfileFieldVisibility = "public" | "friends" | "private";

/**
 * Personal profile information controlled by visibility rules
 */
export interface ProfilePersonalInfo {
  age: number | null;
  hometown: string | null;
  favoriteGame: string | null;
}

/**
 * A single finished game result shown on profile stats
 */
export interface ProfilePlayedGameStat {
  gameId: string;
  type: GameKey;
  playedAt: Date;
  didWin: boolean;
  streak: number;
}
/**
 * Aggregated profile stats shown based on visibility rules
 */
export interface ProfileStatsInfo {
  games: ProfilePlayedGameStat[];
  favoriteGame: GameKey | null;
  overallWinRate: number;
}

/*** TYPES USED IN THE USER API ***/

/**
 * Represents allowed updates to a user.
 */
export type UserUpdateRequest = z.infer<typeof zUserUpdateRequest>;
export const zUserUpdateRequest = z.object({
  password: z.string().optional(),
  display: z.string().optional(),
  canViewStats: z.boolean().optional(),
  age: z.number().int().min(0).max(150).nullable().optional(),
  hometown: z.string().trim().max(120).nullable().optional(),
  favoriteGame: z.string().trim().max(120).nullable().optional(),
  personalInfoVisibility: z.enum(["public", "friends", "private"]).optional(),
});
