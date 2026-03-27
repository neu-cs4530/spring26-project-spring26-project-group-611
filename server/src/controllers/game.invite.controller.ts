import { withAuth, zSendGameInvitePayload, type GameInviteInfo } from "@gamenite/shared";
import { z } from "zod";
import { type RestAPI } from "../types.ts";
import { checkAuth } from "../services/auth.service.ts";
import {
  getInvitesForUser,
  getInvitesSentByUser,
  sendGameInvite,
  toggleAcceptGameInvites,
  acceptInvite,
  declineInvite,
} from "../services/game.invite.service.ts";
import { getGameById } from "../services/game.service.ts";
import { emitGamePlayersUpdated } from "./game.controller.ts";

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

/**
 * POST /api/game-invite/accept
 * Body: { auth: UserAuth, payload: { inviteId: string } }
 *
 * Allows the authenticated user to accept a game invite
 */
export const postAccept: RestAPI<GameInviteInfo> = async (req, res) => {
  const body = withAuth(z.object({ inviteId: z.string() })).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await acceptInvite(user.userId, body.data.payload.inviteId);
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }

  const game = await getGameById(result.gameId);
  if (game) {
    emitGamePlayersUpdated(game.gameId, game.players);
  }

  res.send(result);
};

/**
 * POST /api/game-invite/decline
 * Body: { auth: UserAuth, payload: { inviteId: string } }
 *
 * Allows the authenticated user to decline a game invite
 */
export const postDecline: RestAPI<GameInviteInfo> = async (req, res) => {
  const body = withAuth(z.object({ inviteId: z.string() })).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const result = await declineInvite(user.userId, body.data.payload.inviteId);
  if ("error" in result) {
    res.status(400).send(result);
    return;
  }
  res.send(result);
};
