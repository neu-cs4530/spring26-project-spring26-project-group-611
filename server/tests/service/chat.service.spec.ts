import { describe, expect, it } from "vitest";
import {
  addMessageToChat,
  addMoveLogToChat,
  createChat,
  forceChatById,
  getMoveLog,
} from "../../src/services/chat.service.ts";
import { createMessage } from "../../src/services/message.service.ts";
import { getUserByUsername } from "../../src/services/auth.service.ts";

describe("chat.service", () => {
  it("forceChatById throws for invalid chat id", async () => {
    const user = await getUserByUsername("user1");
    if (!user) throw new Error("user1 not found");

    await expect(forceChatById("missing-chat", user)).rejects.toThrow(
      "user user1 accessed invalid chat id",
    );
  });

  it("addMessageToChat throws for invalid chat id", async () => {
    const user = await getUserByUsername("user1");
    if (!user) throw new Error("user1 not found");

    await expect(addMessageToChat("missing-chat", user, "message-id")).rejects.toThrow(
      "user user1 sent to invalid chat id",
    );
  });

  it("addMoveLogToChat throws for invalid chat id", async () => {
    const user = await getUserByUsername("user1");
    if (!user) throw new Error("user1 not found");

    await expect(addMoveLogToChat("missing-chat", "move", user, new Date())).rejects.toThrow(
      "move log added to invalid chat id",
    );
  });

  it("getMoveLog returns [] for invalid chat id", async () => {
    const moveLog = await getMoveLog("missing-chat");
    expect(moveLog).toStrictEqual([]);
  });

  it("can append message and move log to chat", async () => {
    const user = await getUserByUsername("user1");
    if (!user) throw new Error("user1 not found");

    const chat = await createChat(new Date("2026-01-01T00:00:00.000Z"));
    const createdMessage = await createMessage(
      user,
      "hello chat",
      new Date("2026-01-01T00:01:00.000Z"),
    );

    const updatedChat = await addMessageToChat(chat.chatId, user, createdMessage.messageId);

    expect(updatedChat.messages).toHaveLength(1);
    expect(updatedChat.messages[0]).toMatchObject({
      messageId: createdMessage.messageId,
      text: "hello chat",
      createdBy: { username: "user1" },
    });

    const movePayload = await addMoveLogToChat(
      chat.chatId,
      "user1 made a move",
      user,
      new Date("2026-01-01T00:02:00.000Z"),
    );

    expect(movePayload).toMatchObject({
      chatId: chat.chatId,
      moveDescription: "user1 made a move",
      user: { username: "user1" },
    });

    const moveLog = await getMoveLog(chat.chatId);
    expect(moveLog).toHaveLength(1);
    expect(moveLog[0].moveDescription).toBe("user1 made a move");
    expect(moveLog[0].userId).toBe(user.userId);
  });
});
