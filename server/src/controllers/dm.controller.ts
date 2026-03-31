import { withAuth, type SafeUserInfo } from "@gamenite/shared";
import { z } from "zod";
import { type RestAPI } from "../types.ts";
import { checkAuth } from "../services/auth.service.ts";
import { getOrCreateConversation, sendDirectMessage, getMessages } from "../services/dm.service.ts";

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
