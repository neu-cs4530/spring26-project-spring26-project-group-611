import { describe, expect, it } from "vitest";
import {
  getMessages,
  getOrCreateConversation,
  sendDirectMessage,
} from "../src/services/dm.service.ts";
import {
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
} from "../src/services/friend.service.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

async function getUserId(username: string): Promise<string> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`${username} not found`);
  return user.userId;
}

async function makeFriends(username1: string, username2: string): Promise<void> {
  const request = await sendFriendRequest(username1, username2);
  if ("error" in request) {
    throw new Error(request.error);
  }

  const receiver = await getUserByUsername(username2);
  if (!receiver) throw new Error(`${username2} not found`);

  const accepted = await acceptFriendRequest(request.id, receiver.userId);
  if (accepted && "error" in accepted) {
    throw new Error(accepted.error);
  }
}

describe("getOrCreateConversation", () => {
  it("should fail if user tries to message themselves", async () => {
    const result = await getOrCreateConversation("user1", "user1");
    expect(result).toHaveProperty("error");
  });

  it("should fail if target user does not exist", async () => {
    const result = await getOrCreateConversation("user1", "fakeUser");
    expect(result).toHaveProperty("error");
  });

  it("should fail if users are not friends", async () => {
    const result = await getOrCreateConversation("user1", "user3");
    expect(result).toHaveProperty("error");
  });

  it("should create a conversation for friends", async () => {
    await makeFriends("user1", "user2");

    const result = await getOrCreateConversation("user1", "user2");

    expect(result).toHaveProperty("id");
  });

  it("should return the same conversation if one already exists", async () => {
    await makeFriends("user1", "user2");

    const convo1 = await getOrCreateConversation("user1", "user2");
    if ("error" in convo1) {
      throw new Error(convo1.error);
    }

    const convo2 = await getOrCreateConversation("user1", "user2");
    if ("error" in convo2) {
      throw new Error(convo2.error);
    }

    expect(convo2.id).toBe(convo1.id);
  });
});

describe("sendDirectMessage", () => {
  it("should fail if conversation does not exist", async () => {
    const result = await sendDirectMessage("user1", "fakeConversationId", "hello");
    expect(result).toHaveProperty("error");
  });

  it("should fail if the sender is not part of the conversation", async () => {
    await makeFriends("user1", "user2");

    const convo = await getOrCreateConversation("user1", "user2");
    if ("error" in convo) {
      throw new Error(convo.error);
    }

    const result = await sendDirectMessage("user3", convo.id, "hello");
    expect(result).toHaveProperty("error");
  });

  it("should send a message successfully between friends", async () => {
    await makeFriends("user1", "user2");

    const convo = await getOrCreateConversation("user1", "user2");
    if ("error" in convo) {
      throw new Error(convo.error);
    }

    const result = await sendDirectMessage("user1", convo.id, "hello");
    if ("error" in result) {
      throw new Error(result.error);
    }

    expect(result.text).toBe("hello");
    expect(result.sender.username).toBe("user1");
  });

  it("should fail if users are no longer friends", async () => {
    await makeFriends("user1", "user2");

    const convo = await getOrCreateConversation("user1", "user2");
    if ("error" in convo) {
      throw new Error(convo.error);
    }

    const user1Id = await getUserId("user1");
    const removed = await removeFriend(user1Id, "user2");
    if (removed && "error" in removed) {
      throw new Error(removed.error);
    }

    const result = await sendDirectMessage("user1", convo.id, "are you there?");
    expect(result).toHaveProperty("error");
  });
});

describe("getMessages", () => {
  it("should fail if conversation does not exist", async () => {
    const result = await getMessages("user1", "fakeConversationId");
    expect(result).toHaveProperty("error");
  });

  it("should fail if user is not part of the conversation", async () => {
    await makeFriends("user1", "user2");

    const convo = await getOrCreateConversation("user1", "user2");
    if ("error" in convo) {
      throw new Error(convo.error);
    }

    const result = await getMessages("user3", convo.id);
    expect(result).toHaveProperty("error");
  });

  it("should return messages for a participant in the conversation", async () => {
    await makeFriends("user1", "user2");

    const convo = await getOrCreateConversation("user1", "user2");
    if ("error" in convo) {
      throw new Error(convo.error);
    }

    const sent1 = await sendDirectMessage("user1", convo.id, "hello");
    if ("error" in sent1) {
      throw new Error(sent1.error);
    }

    const sent2 = await sendDirectMessage("user2", convo.id, "hi");
    if ("error" in sent2) {
      throw new Error(sent2.error);
    }

    const messages = await getMessages("user1", convo.id);
    if ("error" in messages) {
      throw new Error(messages.error);
    }

    expect(messages).toHaveLength(2);
    expect(messages[0].text).toBe("hello");
    expect(messages[0].sender.username).toBe("user1");
    expect(messages[1].text).toBe("hi");
    expect(messages[1].sender.username).toBe("user2");
  });
});
