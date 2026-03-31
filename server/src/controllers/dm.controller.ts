import { withAuth, type SafeUserInfo } from "@gamenite/shared";
import { z } from "zod";
import { type RestAPI, type SocketAPI } from "../types.ts";
import { checkAuth, enforceAuth } from "../services/auth.service.ts";
import { getOrCreateConversation, sendDirectMessage, getMessages } from "../services/dm.service.ts";
import { logSocketError } from "./socket.controller.ts";

type DmStartResponse = { id: string };

type DmMessageResponse = {
  id: string;
  text: string;
  sender: SafeUserInfo;
  createdAt: Date;
};

type DmMessagesResponse = DmMessageResponse[];
export const postStart: RestAPI<DmStartResponse> = async (req, res) => {
  const body = withAuth(z.object({ username: z.string() })).safeParse(req.body);

  if (!body.success) {
    res.status(400).send({ error: "Bad request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid auth" });
    return;
  }

  const result = await getOrCreateConversation(user.username, body.data.payload.username);

  if ("error" in result) {
    res.status(400).send(result);
    return;
  }

  res.send(result);
};

export const postSend: RestAPI<DmMessageResponse> = async (req, res) => {
  const body = withAuth(
    z.object({
      conversationId: z.string(),
      text: z.string(),
    }),
  ).safeParse(req.body);

  if (!body.success) {
    res.status(400).send({ error: "Bad request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid auth" });
    return;
  }

  const result = await sendDirectMessage(
    user.username,
    body.data.payload.conversationId,
    body.data.payload.text,
  );

  if ("error" in result) {
    res.status(400).send(result);
    return;
  }

  res.send(result);
};

export const postMessages: RestAPI<DmMessagesResponse> = async (req, res) => {
  const body = withAuth(z.object({ conversationId: z.string() })).safeParse(req.body);

  if (!body.success) {
    res.status(400).send({ error: "Bad request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid auth" });
    return;
  }

  const result = await getMessages(user.username, body.data.payload.conversationId);

  if ("error" in result) {
    res.status(400).send(result);
    return;
  }

  res.send(result);
};

const zDmConversationPayload = z.object({
  conversationId: z.string(),
});

const zDmSendPayload = z.object({
  conversationId: z.string(),
  text: z.string(),
});

export const socketJoin: SocketAPI = (socket) => async (body) => {
  try {
    const {
      auth,
      payload: { conversationId },
    } = withAuth(zDmConversationPayload).parse(body);

    const user = await enforceAuth(auth);

    const messages = await getMessages(user.username, conversationId);

    if ("error" in messages) {
      throw new Error(messages.error);
    }

    await socket.join(conversationId);
    socket.emit("dmJoined", { conversationId, messages });
  } catch (err) {
    logSocketError(socket, err);
  }
};

export const socketLeave: SocketAPI = (socket) => async (body) => {
  try {
    const {
      auth,
      payload: { conversationId },
    } = withAuth(zDmConversationPayload).parse(body);

    await enforceAuth(auth);
    await socket.leave(conversationId);
  } catch (err) {
    logSocketError(socket, err);
  }
};

export const socketSendMessage: SocketAPI = (socket, io) => async (body) => {
  try {
    const {
      auth,
      payload: { conversationId, text },
    } = withAuth(zDmSendPayload).parse(body);

    const user = await enforceAuth(auth);

    const message = await sendDirectMessage(user.username, conversationId, text);

    if ("error" in message) {
      throw new Error(message.error);
    }

    io.to(conversationId).emit("dmNewMessage", { conversationId, message });
  } catch (err) {
    logSocketError(socket, err);
  }
};
