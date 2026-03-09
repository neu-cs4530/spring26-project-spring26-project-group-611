import { FriendRequestRepo, UserRepo } from "../repository.ts";

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
