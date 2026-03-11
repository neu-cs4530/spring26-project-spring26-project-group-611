import { withAuth, zSendFriendRequestPayload, type FriendRequestInfo } from "@gamenite/shared";
import { type RestAPI } from "../types.ts";
import { checkAuth } from "../services/auth.service.ts";
import {
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
