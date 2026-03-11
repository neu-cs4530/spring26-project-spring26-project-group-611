<<<<<<< Updated upstream
import { FriendRequestRepo, UserRepo } from "../repository.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import type { IncomingFriendRequestInfo, SafeUserInfo } from "@gamenite/shared";

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

  const friends = await Promise.all(
    user.friends.map(async (friendID) => populateSafeUserInfo(friendID)),
  );

  return Promise.resolve(friends);
}

/**
 * Returns all of the incoming friend requests.
 * @param userID Current user logged in
 * @returns Resolves when the list of all incoming pending requests are listed, or an error message if the user doesn't exist.
 */
export async function getIncomingFriendRequests(
  userID: string,
): Promise<IncomingFriendRequestInfo[] | { error: string }> {
  const user = await UserRepo.find(userID);

  if (!user) {
    return Promise.resolve({ error: "User not found" });
  }

  const requestKeys = await FriendRequestRepo.getAllKeys();
  const requests = await FriendRequestRepo.getMany(requestKeys);

  const incomingRequests = await Promise.all(
    requests
      .map((request, index) => ({ request, requestId: requestKeys[index] }))
      .filter(({ request }) => request.toUser === userID && request.status === "pending")
      .map(async ({ request, requestId }) => ({
        requestId,
        fromUser: await populateSafeUserInfo(request.fromUser),
      })),
  );
  return Promise.resolve(incomingRequests);
=======
import type { FriendRequestInfo } from "@gamenite/shared";
import { FriendRequestRepo } from "../repository.ts";
import { getUserByUsername } from "./auth.service.ts";

/**
 * Convert a DB record + ID into a client safe FriendRequestInfo object
 */
function toFriendRequestInfo(
  id: string,
  record: Awaited<ReturnType<typeof FriendRequestRepo.get>>,
): FriendRequestInfo {
  return {
    id,
    fromUsername: record.fromUsername,
    toUsername: record.toUsername,
    status: record.status,
    createdAt: new Date(record.createdAt),
  };
}

/**
 * Retrieve all friend request where the given username is either sender or recipient and the status matches `status`
 */
async function getRequestsByStatus(
  username: string,
  role: "from" | "to",
  status: "pending" | "accepted" | "declined",
): Promise<{ id: string; record: Awaited<ReturnType<typeof FriendRequestRepo.get>> }[]> {
  const keys = await FriendRequestRepo.getAllKeys();
  const results: { id: string; record: Awaited<ReturnType<typeof FriendRequestRepo.get>> }[] = [];
  for (const key of keys) {
    const rec = await FriendRequestRepo.find(key);
    if (!rec) continue;
    if (rec.status !== status) continue;
    if (role === "from" && rec.fromUsername === username) results.push({ id: key, record: rec });
    if (role === "to" && rec.toUsername === username) results.push({ id: key, record: rec });
  }
  return results;
}

/**
 * Returns true if `a` and `b` are already friends (i.e. an accepted request exists between them in either direction)
 */
async function areFriends(a: string, b: string): Promise<boolean> {
  const keys = await FriendRequestRepo.getAllKeys();
  for (const key of keys) {
    const rec = await FriendRequestRepo.find(key);
    if (!rec || rec.status !== "accepted") continue;
    if (
      (rec.fromUsername === a && rec.toUsername === b) ||
      (rec.fromUsername === b && rec.toUsername === a)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Returns true if there is already a "pending" request between a and b in either direction
 */
async function hasPendingRequest(a: string, b: string): Promise<boolean> {
  const keys = await FriendRequestRepo.getAllKeys();
  for (const key of keys) {
    const rec = await FriendRequestRepo.find(key);
    if (!rec || rec.status !== "pending") continue;
    if (
      (rec.fromUsername === a && rec.toUsername === b) ||
      (rec.fromUsername === b && rec.toUsername === a)
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
  const target = await getUserByUsername(toUsername);
  if (!target) {
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
    fromUsername,
    toUsername,
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
  const results = await getRequestsByStatus(toUsername, "to", "pending");
  return results.map(({ id, record }) => toFriendRequestInfo(id, record));
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
  const results = await getRequestsByStatus(fromUsername, "to", "pending");
  return results.map(({ id, record }) => toFriendRequestInfo(id, record));
>>>>>>> Stashed changes
}
