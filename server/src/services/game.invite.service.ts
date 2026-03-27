import { type GameInviteInfo } from "@gamenite/shared";
import { GameInviteRepo, GameRepo, UserRepo } from "../repository.ts";
import { getUserByUsername } from "./auth.service.ts";
import { joinGame } from "./game.service.ts";

/**
 * Convert a stored GameInviteRecord +id into a client-safe GameInviteInfo.
 */
async function toGameInviteInfo(
  inviteId: string,
  record: Awaited<ReturnType<typeof GameInviteRepo.get>>,
): Promise<GameInviteInfo> {
  const fromUserRecord = await UserRepo.find(record.fromUser);
  const toUserRecord = await UserRepo.find(record.toUser);
  return {
    inviteId,
    gameId: record.gameId,
    fromUsername: fromUserRecord?.username ?? record.fromUser,
    toUsername: toUserRecord?.username ?? record.toUser,
    status: record.status,
    createdAt: new Date(record.createdAt),
  };
}

/**
 * Sending a game invite from the host to a target player
 *
 * Validation rules:
 * - The game must exist and be private
 * - The requesting user must be the game's host
 * - The target player must exist
 * - The target player must have `acceptGameInvites` enabled
 * - A pending invite for the same game+player must not already exist
 * - The target player must not alrady be in the game
 *
 * @param hostUserId - The user ID of the host sending the invite
 * @param toUsername - The username of the player to invite
 * @param gameId - The ID of the private game
 * @returns the created GameInviteInfo, or an error object
 */
export async function sendGameInvite(
  hostUserId: string,
  toUsername: string,
  gameId: string,
): Promise<GameInviteInfo | { error: string }> {
  const game = await GameRepo.find(gameId);
  if (!game) {
    return { error: "Game not found" };
  }
  if (game.visibility === "public") {
    return { error: "Cannot send invites for a public game" };
  }
  if (game.createdBy !== hostUserId) {
    return { error: "Only the host can send invites for this game" };
  }
  if (game.state) {
    return { error: "Cannot invite players to a game that has already started" };
  }
  const toUser = await getUserByUsername(toUsername);
  if (!toUser) {
    return { error: "Player not found" };
  }
  if (toUser.userId === hostUserId) {
    return { error: "Cannot invite yourself to your own game" };
  }

  const hostUserRecord = await UserRepo.find(hostUserId);
  if (!hostUserRecord) {
    return { error: "Host user not found" };
  }
  if (!hostUserRecord.friends.includes(toUser.userId)) {
    return { error: "You can only invite friends to a private game" };
  }

  const toUserRecord = await UserRepo.find(toUser.userId);
  if (!toUserRecord) {
    return { error: "Player not found" };
  }
  if (!toUserRecord.acceptGameInvites) {
    return { error: `${toUsername} is not accepting game invites` };
  }
  if (game.players.includes(toUser.userId)) {
    return { error: "Player is already in the game" };
  }

  const invitees = game.invitees ?? [];
  if (invitees.includes(toUser.userId)) {
    return { error: "An invite has already been sent to this player for this game" };
  }
  // check for an existing pending invite
  const allKeys = await GameInviteRepo.getAllKeys();
  for (const key of allKeys) {
    const existing = await GameInviteRepo.find(key);
    if (
      existing &&
      existing.gameId === gameId &&
      existing.toUser === toUser.userId &&
      existing.status === "pending"
    ) {
      return { error: "An invite has already been sent to this player for this game" };
    }
  }

  const inviteId = await GameInviteRepo.add({
    gameId,
    fromUser: hostUserId,
    toUser: toUser.userId,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  game.invitees = [...invitees, toUser.userId];
  await GameRepo.set(gameId, game);

  return toGameInviteInfo(inviteId, await GameInviteRepo.get(inviteId));
}

/**
 * Returns all pending game invites sent to the given user
 *
 * @param userId - The user ID to fetch pending invites for
 * @returns a list of GameInviteInfo objects
 */
export async function getInvitesForUser(userId: string): Promise<GameInviteInfo[]> {
  const allKeys = await GameInviteRepo.getAllKeys();
  const results: GameInviteInfo[] = [];
  for (const key of allKeys) {
    const record = await GameInviteRepo.find(key);
    if (record && record.toUser === userId && record.status === "pending") {
      results.push(await toGameInviteInfo(key, record));
    }
  }
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Returns all pending game invites sent by the given host user
 *
 * @param hostUserId - The user ID of the host
 * @returns a list of GameInviteInfo objects
 */
export async function getInvitesSentByUser(hostUserId: string): Promise<GameInviteInfo[]> {
  const allKeys = await GameInviteRepo.getAllKeys();
  const results: GameInviteInfo[] = [];
  for (const key of allKeys) {
    const record = await GameInviteRepo.find(key);
    if (record && record.fromUser === hostUserId && record.status === "pending") {
      results.push(await toGameInviteInfo(key, record));
    }
  }
  return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Toggles the `acceptGameInvites` flag for a user
 *
 * @param userId - The user Id to update
 * @returns the new value of `acceptGameInvites`, or an error object
 */
export async function toggleAcceptGameInvites(
  userId: string,
): Promise<{ acceptGameInvites: boolean } | { error: string }> {
  const user = await UserRepo.find(userId);
  if (!user) {
    return { error: "User not found" };
  }
  user.acceptGameInvites = !user.acceptGameInvites;
  await UserRepo.set(userId, user);
  return { acceptGameInvites: user.acceptGameInvites };
}

/**
 * Accept a game invite by updating its status
 *
 * @param userId - The user ID of the invitee
 * @param inviteId - The invite ID to accept
 * @returns the updated GameInviteInfo, or an error object
 */
export async function acceptInvite(
  userId: string,
  inviteId: string,
): Promise<GameInviteInfo | { error: string }> {
  const invite = await GameInviteRepo.find(inviteId);
  if (!invite) {
    return { error: "Invite not found" };
  }
  if (invite.toUser !== userId) {
    return { error: "You cannot accept this invite" };
  }
  if (invite.status !== "pending") {
    return { error: "This invite is no longer pending" };
  }

  const game = await GameRepo.find(invite.gameId);
  if (!game) {
    return { error: "Game not found" };
  }

  const alreadyInGame = game.players.includes(userId);
  if (!alreadyInGame) {
    const user = await UserRepo.find(userId);
    if (!user) {
      return { error: "User not found" };
    }
    try {
      await joinGame(invite.gameId, { userId, username: user.username });
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not join game" };
    }
  }

  invite.status = "accepted";
  await GameInviteRepo.set(inviteId, invite);

  return toGameInviteInfo(inviteId, invite);
}

/**
 * Decline a game invite by updating its status
 *
 * @param userId - The user ID of the invitee
 * @param inviteId - The invite ID to decline
 * @returns the updated GameInviteInfo, or an error object
 */
export async function declineInvite(
  userId: string,
  inviteId: string,
): Promise<GameInviteInfo | { error: string }> {
  const invite = await GameInviteRepo.find(inviteId);
  if (!invite) {
    return { error: "Invite not found" };
  }
  if (invite.toUser !== userId) {
    return { error: "You cannot decline this invite" };
  }
  if (invite.status !== "pending") {
    return { error: "This invite is no longer pending" };
  }

  invite.status = "declined";
  await GameInviteRepo.set(inviteId, invite);

  return toGameInviteInfo(inviteId, invite);
}
