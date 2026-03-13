import { withAuth, zSendGameInvitePayload, type GameInviteInfo } from "@gamenite/shared";
import { z } from "zod";
import { type RestAPI } from "../types.ts";
import { checkAuth } from "../services/auth.service.ts";
import {
  getInvitesForUser,
  getInvitesSentByUser,
  sendGameInvite,
  toggleAcceptGameInvites,
} from "../services/game.invite.service.ts";

/**
 * POST /api/game-invite/send
 * Body: { auth: UserAuth, payload: {gameId: string, toUsername: string } }
 *
 * Allows the authenticated host to send a private game invite to another player
 */
export const postSend: RestAPI<GameInviteInfo> = async (req, res) => {
  const body = withAuth(zSendGameInvitePayload).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await sendGameInvite(
    user.userId,
    body.data.payload.toUsername,
    body.data.payload.gameId,
  );
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }
  res.status(201).send(result);
};

/**
 * POST /api/game-invite/incoming
 * Body: { auth: UserAuth, payload: {} }
 *
 * Returns all pending game invites sent to the user
 */
export const postIncoming: RestAPI<GameInviteInfo[]> = async (req, res) => {
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

  res.send(await getInvitesForUser(user.userId));
};

/**
 * POST /api/game-invite/outgoing
 * Body: { auth: UserAuth, payload: {} }
 *
 * Returns all pending game invites sent by the user
 */
export const postOutgoing: RestAPI<GameInviteInfo[]> = async (req, res) => {
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

  res.send(await getInvitesSentByUser(user.userId));
};

/**
 * POST /api/game-invite/toggle-accept
 * Body: { auth: UserAuth, payload: {} }
 *
 * Toggles the authenticated user's `acceptGameInvites` setting
 * Returns new value of the flag
 */
export const postToggleAccept: RestAPI<{ acceptGameInvites: boolean }> = async (req, res) => {
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

  const result = await toggleAcceptGameInvites(user.userId);
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }
  res.status(201).send(result);
};
