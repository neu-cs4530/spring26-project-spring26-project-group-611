import {
  withAuth,
  zFriendRequestActionPayload,
  zSendFriendRequestPayload,
  type FriendRequestInfo,
  type SafeUserInfo,
} from "@gamenite/shared";
import { type RestAPI } from "../types.ts";
import { checkAuth } from "../services/auth.service.ts";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getCurrentFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  sendFriendRequest,
} from "../services/friend.service.ts";
import { z } from "zod";

/**
 * POST /api/friend-request/send
 * Body: { auth: UserAuth, payload: { toUsername: string } }
 *
 * Sends a friend request from the authenticated user to `toUsername`.
 */
export const postSend: RestAPI<FriendRequestInfo> = async (req, res) => {
  const body = withAuth(zSendFriendRequestPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await sendFriendRequest(user.username, body.data.payload.toUsername);
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }

  res.status(201).send(result);
};

/**
 * POST /api/friend-request/accept
 * Body: { auth: UserAuth, payload: { requestId: string } }
 *
 * Accepts a pending friend request sent to the authenticated user.
 */
export const postAccept: RestAPI<{ ok: true }> = async (req, res) => {
  const body = withAuth(zFriendRequestActionPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await acceptFriendRequest(body.data.payload.requestId, user.userId);
  if (result && "error" in result) {
    res.status(400).send(result);
    return;
  }

  res.send({ ok: true });
};

/**
 * POST /api/friend-request/decline
 * Body: { auth: UserAuth, payload: { requestId: string } }
 *
 * Declines a pending friend request sent to the authenticated user.
 */
export const postDecline: RestAPI<{ ok: true }> = async (req, res) => {
  const body = withAuth(zFriendRequestActionPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await declineFriendRequest(body.data.payload.requestId, user.userId);
  if (result && "error" in result) {
    res.status(400).send(result);
    return;
  }

  res.send({ ok: true });
};

/**
 * POST /api/friend-request/incoming
 * Body: { auth: UserAuth, payload: {} }
 *
 * Returns all pending friend requests sent to the authenticated user.
 */
export const postIncoming: RestAPI<FriendRequestInfo[]> = async (req, res) => {
  const body = withAuth(z.object({})).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const requests = await getIncomingFriendRequests(user.username);
  res.send(requests);
};

/**
 * POST /api/friend-request/outgoing
 * Body: {auth: UserAuth, payload: {} }
 *
 * Returns all pending friend requests sent by the authenticated user
 */
export const postOutgoing: RestAPI<FriendRequestInfo[]> = async (req, res) => {
  const body = withAuth(z.object({})).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }
  const requests = await getOutgoingFriendRequests(user.username);
  res.send(requests);
};

/**
 * POST /api/friend-request/friends
 * Body: { auth: UserAuth, payload: {} }
 *
 * Returns all accepted friends for the authenticated user.
 */
export const postFriends: RestAPI<SafeUserInfo[]> = async (req, res) => {
  const body = withAuth(z.object({})).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const friends = await getCurrentFriends(user.userId);
  if ("error" in friends) {
    res.status(400).send(friends);
    return;
  }

  res.send(friends);
};

/**
 * POST /api/friend-request/cancel
 * Body: { auth: UserAuth, payload: { requestId: string } }
 *
 * Cancels an outgoing friend request.
 */
export const postCancel: RestAPI<{ ok: true }> = async (req, res) => {
  const body = withAuth(zFriendRequestActionPayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await cancelFriendRequest(body.data.payload.requestId, user.userId);

  if (result && "error" in result) {
    res.status(400).send(result);
    return;
  }

  res.send({ ok: true });
};
