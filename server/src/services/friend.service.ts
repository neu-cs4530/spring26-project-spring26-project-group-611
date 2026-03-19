import { FriendRequestRepo, UserRepo } from "../repository.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import type { FriendRequestInfo, SafeUserInfo } from "@gamenite/shared";
import { getUserByUsername } from "./auth.service.ts";

/**
 * Allows a user to accept a friend request sent to them.
 * @param requestId the ID of the request sent.
 * @param currentUserId the ID of the logged in User
 * @returns Resolves when the friend request has been accepted, or an error message if the request is invalid.
 */
export async function acceptFriendRequest(
  requestId: string,
  currentUserId: string,
): Promise<void | { error: string }> {
  const request = await FriendRequestRepo.find(requestId);

  if (!request) {
    return { error: "Friend request not found" };
  }

  if (request.toUser !== currentUserId) {
    return { error: "You cannot accept this request" };
  }

  // if it was denied or already accepted it cannot be accepted again
  if (request.status !== "pending") {
    return { error: "Friend request already processed" };
  }

  const sender = await UserRepo.find(request.fromUser);
  const receiver = await UserRepo.find(request.toUser);

  if (!sender || !receiver) {
    return { error: "One or more users no longer exist" };
  }

  sender.friends = sender.friends ?? [];
  receiver.friends = receiver.friends ?? [];

  // add each other as friends if we are not already friends
  if (!sender.friends.includes(request.toUser)) {
    sender.friends.push(request.toUser);
  }

  if (!receiver.friends.includes(request.fromUser)) {
    receiver.friends.push(request.fromUser);
  }

  await UserRepo.set(request.fromUser, sender);
  await UserRepo.set(request.toUser, receiver);

  request.status = "accepted";
  await FriendRequestRepo.set(requestId, request);

  return Promise.resolve();
}

/**
 * Allows a user to decline a friend request.
 * @param requestId ID of the request
 * @param currentUserId the current user logged in
 * @returns Resolves when the friend request has been declined, or an error message if the request is invalid.
 */
export async function declineFriendRequest(
  requestId: string,
  currentUserId: string,
): Promise<void | { error: string }> {
  const request = await FriendRequestRepo.find(requestId);

  if (!request) {
    return Promise.resolve({ error: "Friend request not found" });
  }

  if (request.toUser !== currentUserId) {
    return Promise.resolve({ error: "You cannot decline this request" });
  }

  if (request.status !== "pending") {
    return Promise.resolve({ error: "Friend request already processed" });
  }

  request.status = "declined";
  await FriendRequestRepo.set(requestId, request);

  return Promise.resolve();
}

/**
 * Helper function to get all of the current friends of a user and turns it into usernames rather than ids.
 * @param userID current user logged in
 * @returns Resolves when the list of all the users friends are listed by username, or an error message if the user doesn't exist.
 */
export async function getCurrentFriends(
  userID: string,
): Promise<SafeUserInfo[] | { error: string }> {
  const user = await UserRepo.find(userID);

  if (!user) {
    return Promise.resolve({ error: "User not found" });
  }

  const friendIds = user.friends ?? [];

  const friends = await Promise.all(
    friendIds.map(async (friendID) => populateSafeUserInfo(friendID)),
  );

  return Promise.resolve(friends);
}

/**
 * Convert a DB record + ID into a client safe FriendRequestInfo object
 * Looks up usernames from RecordId to match the shared FriendRequestInfo type
 */
async function toFriendRequestInfo(
  id: string,
  record: Awaited<ReturnType<typeof FriendRequestRepo.get>>,
): Promise<FriendRequestInfo> {
  const fromUserRecord = await UserRepo.find(record.fromUser);
  const toUserRecord = await UserRepo.find(record.toUser);
  return {
    id,
    fromUsername: fromUserRecord?.username ?? record.fromUser,
    fromDisplay: fromUserRecord?.display ?? fromUserRecord?.username ?? record.fromUser,
    toUsername: toUserRecord?.username ?? record.toUser,
    status: record.status,
    createdAt: new Date(record.createdAt),
  };
}

/**
 * Returns true if `a` and `b` are already friends (i.e. an accepted request exists between them in either direction)
 */
async function areFriends(fromUsername: string, toUsername: string): Promise<boolean> {
  const from = await getUserByUsername(fromUsername);
  const to = await getUserByUsername(toUsername);
  if (!from || !to) return false;
  const keys = await FriendRequestRepo.getAllKeys();
  for (const key of keys) {
    const rec = await FriendRequestRepo.find(key);
    if (!rec || rec.status !== "accepted") continue;
    if (
      (rec.fromUser === from.userId && rec.toUser === to.userId) ||
      (rec.fromUser === to.userId && rec.toUser === from.userId)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if there is already a "pending" request between a and b in either direction
 */
async function hasPendingRequest(fromUsername: string, toUsername: string): Promise<boolean> {
  const from = await getUserByUsername(fromUsername);
  const to = await getUserByUsername(toUsername);
  if (!from || !to) return false;
  const keys = await FriendRequestRepo.getAllKeys();
  for (const key of keys) {
    const rec = await FriendRequestRepo.find(key);
    if (!rec || rec.status !== "pending") continue;
    if (
      (rec.fromUser === from.userId && rec.toUser === to.userId) ||
      (rec.fromUser === to.userId && rec.toUser === from.userId)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Send a friend request fromm `fromUsername` to `toUsername`.
 *
 * Validates:
 * `toUsername` must exist in the database
 * cannot send a request to yourself
 * cannot send if already friends
 * cannot send if a pending request already xists in either direction
 *
 * @returns The created FriendRequestInfo, or an error object
 */
export async function sendFriendRequest(
  fromUsername: string,
  toUsername: string,
): Promise<FriendRequestInfo | { error: string }> {
  //cannot send a request to yourself
  if (fromUsername === toUsername) {
    return { error: "You cannot send a friend request to yourself" };
  }
  //target must exist
  const fromUser = await getUserByUsername(fromUsername);
  const toUser = await getUserByUsername(toUsername);
  if (!toUser || !fromUser) {
    return { error: "User not found" };
  }
  //cannot send if already friends
  if (await areFriends(fromUsername, toUsername)) {
    return { error: "You are already friends with this user" };
  }
  //Prevent duplicate pending request(in either direction
  if (await hasPendingRequest(fromUsername, toUsername)) {
    return { error: "A pending friend request already exists between you and this user" };
  }

  const id = await FriendRequestRepo.add({
    fromUser: fromUser.userId,
    toUser: toUser.userId,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  const record = await FriendRequestRepo.get(id);
  return toFriendRequestInfo(id, record);
}

/**
 * Get all ** incoming ** (pendng) friend request for `toUsername`
 *
 * @returns A list of FriendRequestInfo object where `toUsername` is the recipient and the status is "pending"
 *
 */
export async function getIncomingFriendRequests(toUsername: string): Promise<FriendRequestInfo[]> {
  const userRes = await getUserByUsername(toUsername);
  if (!userRes) return [];
  const keys = await FriendRequestRepo.getAllKeys();
  const results: FriendRequestInfo[] = [];
  for (const key of keys) {
    const rec = await FriendRequestRepo.find(key);
    if (!rec || rec.status !== "pending" || rec.toUser !== userRes.userId) continue;
    results.push(await toFriendRequestInfo(key, rec));
  }
  return results;
}

/**
 * Get all ** outgoing ** (pendng) friend request for `toUsername`
 *
 * @returns A list of FriendRequestInfo object where `toUsername` is the recipient and the status is "outcoming"
 *
 */
export async function getOutgoingFriendRequests(
  fromUsername: string,
): Promise<FriendRequestInfo[]> {
  const userRes = await getUserByUsername(fromUsername);
  if (!userRes) return [];
  const keys = await FriendRequestRepo.getAllKeys();
  const results: FriendRequestInfo[] = [];
  for (const key of keys) {
    const rec = await FriendRequestRepo.find(key);
    if (!rec || rec.status !== "pending" || rec.fromUser !== userRes.userId) continue;
    results.push(await toFriendRequestInfo(key, rec));
  }
  return results;
}

export async function cancelFriendRequest(
  requestId: string,
  currentUserId: string,
): Promise<void | { error: string }> {
  const request = await FriendRequestRepo.find(requestId);

  if (!request) {
    return { error: "Friend request not found" };
  }

  // Only sender can cancel
  if (request.fromUser !== currentUserId) {
    return { error: "You cannot cancel this request" };
  }

  if (request.status !== "pending") {
    return { error: "Request already processed" };
  }

  await FriendRequestRepo.delete(requestId);

  return;
}
