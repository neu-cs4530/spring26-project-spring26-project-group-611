import {
  type ProfileFieldVisibility,
  type ProfileViewInfo,
  type SafeUserInfo,
  type UserUpdateRequest,
} from "@gamenite/shared";
import { getUserByUsername, updateAuth } from "./auth.service.ts";
import { getProfileStats } from "./profileStats.service.ts";
import { UserRepo } from "../repository.ts";

const disallowedUsernames = new Set(["login", "signup", "list"]);

/**
 * Retrieves a single user from the database.
 *
 * @param userId - Valid user id.
 * @returns the found user object (without the password).
 */
export async function populateSafeUserInfo(userId: string): Promise<SafeUserInfo> {
  const record = await UserRepo.get(userId);
  return Promise.resolve({
    username: record.username,
    display: record.display,
    createdAt: new Date(record.createdAt),
  });
}

/**
 * Create and store a new user
 *
 * @param newUser - The user object to be saved, containing user details like username, password, etc.
 * @returns Resolves with the saved user object (without the password) or an error message.
 */
export async function createUser(
  username: string,
  password: string,
  createdAt: Date,
): Promise<SafeUserInfo | { error: string }> {
  if ((await getUserByUsername(username)) !== null) {
    return { error: "User already exists" };
  }
  if (disallowedUsernames.has(username)) {
    return { error: "That is not a permitted username" };
  }
  const id = await UserRepo.add({
    username,
    createdAt: createdAt.toISOString(),
    display: username,
    friends: [],
    canViewStats: true,
    acceptGameInvites: true,
    age: null,
    hometown: null,
    favoriteGame: null,
    personalInfoVisibility: "private",
  });
  await updateAuth(username, password, id);
  return Promise.resolve({
    username,
    createdAt,
    display: username,
  });
}

/**
 * Retrieves a list of usernames from the database
 *
 * @param usernames - A list of usernames
 * @returns the SafeUserInfo objects corresponding to those users
 * @throws if any of the usernames are not valid
 */
export async function getUsersByUsername(usernames: string[]): Promise<SafeUserInfo[]> {
  return Promise.all(
    usernames.map(async (username) => {
      const user = await getUserByUsername(username);
      if (user === null) {
        throw new Error(`No user ${username}`);
      }
      return populateSafeUserInfo(user.userId);
    }),
  );
}

/**
 * Search for users whose usernames contain the given query
 */
export async function searchUsersByUsername(query: string): Promise<SafeUserInfo[]> {
  const keys = await UserRepo.getAllKeys();
  const users = await UserRepo.getMany(keys);

  return users
    .filter((u) => u.username.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 20)
    .map((u) => ({
      username: u.username,
      display: u.display,
      createdAt: new Date(u.createdAt),
    }));
}

/**
 * Updates user information in the database
 *
 * @param username - A valid username for the user to update
 * @param updates - An object that defines the fields to be updated and their new values
 * @returns the updated user object (without the password)
 * @throws if the username does not exist in the database
 */
export async function updateUser(
  username: string,
  {
    display,
    password,
    canViewStats,
    age,
    hometown,
    favoriteGame,
    personalInfoVisibility,
  }: UserUpdateRequest,
): Promise<SafeUserInfo> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`No user ${username}`);
  if (password !== undefined) await updateAuth(username, password, user.userId);
  const newUser = await UserRepo.get(user.userId);
  if (display !== undefined) newUser.display = display;
  if (canViewStats !== undefined) newUser.canViewStats = canViewStats;
  if (age !== undefined) newUser.age = age;
  if (hometown !== undefined) newUser.hometown = hometown;
  if (favoriteGame !== undefined) newUser.favoriteGame = favoriteGame;
  if (personalInfoVisibility !== undefined) newUser.personalInfoVisibility = personalInfoVisibility;
  await UserRepo.set(user.userId, newUser);
  return populateSafeUserInfo(user.userId);
}

/**
 * Determine whether a field with visibility controls can be viewed
 */
export function canViewerSeeField(
  isSelf: boolean,
  areFriends: boolean,
  visibility: ProfileFieldVisibility,
): boolean {
  if (isSelf) return true;
  if (visibility === "public") return true;
  if (visibility === "friends") return areFriends;
  return false;
}

/**
 *  Determines whether a profile viewer can see target game stats.
 */
export function canViewerSeeStats(
  isSelf: boolean,
  areFriends: boolean,
  targetCanViewStats: boolean | undefined,
): boolean {
  return isSelf || areFriends || (targetCanViewStats ?? true);
}

/**
 * Returns profile information for `targetUsername` as viewed by `viewerUsername`.
 * Personal information is friend-gated and stats visibility is controlled by target settings.
 */
export async function getProfileViewByUsername(
  targetUsername: string,
  viewerUsername: string,
): Promise<ProfileViewInfo | null> {
  const target = await getUserByUsername(targetUsername);
  const viewer = await getUserByUsername(viewerUsername);
  if (!target || !viewer) return null;

  const targetRecord = await UserRepo.get(target.userId);
  const isSelf = target.userId === viewer.userId;
  const areFriends = (targetRecord.friends ?? []).includes(viewer.userId);
  const canViewStats = canViewerSeeStats(isSelf, areFriends, targetRecord.canViewStats);
  const personalInfoVisibility = targetRecord.personalInfoVisibility ?? "private";
  const canViewPersonalInfo = canViewerSeeField(isSelf, areFriends, personalInfoVisibility);
  const stats = canViewStats ? await getProfileStats(target.userId) : null;

  return {
    username: targetRecord.username,
    display: targetRecord.display,
    createdAt: isSelf || areFriends ? new Date(targetRecord.createdAt) : null,
    areFriends,
    canViewStats,
    stats,
    personalInfoVisibility,
    personalInfo: canViewPersonalInfo
      ? {
          age: targetRecord.age ?? null,
          hometown: targetRecord.hometown ?? null,
          favoriteGame: targetRecord.favoriteGame ?? null,
        }
      : null,
  };
}
