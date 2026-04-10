import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";
import { socketJoin, socketLeave, socketSendMessage } from "../src/controllers/dm.controller.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";
import { sendFriendRequest, acceptFriendRequest } from "../src/services/friend.service.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import { getOrCreateConversation } from "../src/services/dm.service.ts";

vi.mock(import("../src/controllers/socket.controller.ts"), () => {
  return { logSocketError: vi.fn() };
});

const auth1 = { username: "user1", password: "pwd1111" };
const auth3 = { username: "user3", password: "pwd3333" };

const MockGameServer = vi.fn(
  class {
    to = vi.fn(() => this);
    emit = vi.fn();
  },
);

const MockGameServerSocket = vi.fn(
  class {
    id = "mock-dm-socket";
    rooms = new Set<string>();
    join = vi.fn((roomId: string) => {
      this.rooms.add(roomId);
    });
    leave = vi.fn((roomId: string) => {
      this.rooms.delete(roomId);
    });
    emit = vi.fn();
    to = vi.fn(() => this);
  },
);

async function makeFriends(usernameA: string, usernameB: string) {
  const request = await sendFriendRequest(usernameA, usernameB);
  if ("error" in request) {
    // Seed or previous tests may already establish friendship.
    if (request.error.includes("already") || request.error.includes("friends")) {
      return;
    }
    throw new Error(request.error);
  }

  const receiver = await getUserByUsername(usernameB);
  if (!receiver) {
    throw new Error("receiver not found");
  }

  const accepted = await acceptFriendRequest(request.id, receiver.userId);
  if (accepted && "error" in accepted) {
    throw new Error(accepted.error);
  }
}

async function createConversationBetweenUser1AndUser2() {
  await makeFriends("user1", "user2");
  const convo = await getOrCreateConversation("user1", "user2");
  if ("error" in convo) {
    throw new Error(convo.error);
  }
  return convo.id;
}

describe("dm socket handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("socketJoin logs auth errors", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketJoin(
      socket,
      io,
    )({
      auth: { ...auth1, password: "wrong" },
      payload: { conversationId: "c1" },
    });

    expect(logSocketError).toHaveBeenCalled();
  });

  it("socketJoin joins room and emits dmJoined", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    const conversationId = await createConversationBetweenUser1AndUser2();

    await socketJoin(socket, io)({ auth: auth1, payload: { conversationId } });

    expect(socket.join).toHaveBeenCalledWith(conversationId);
    expect(socket.emit).toHaveBeenCalledWith(
      "dmJoined",
      expect.objectContaining({ conversationId, messages: expect.any(Array) }),
    );
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("socketLeave leaves the room", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    const conversationId = await createConversationBetweenUser1AndUser2();

    await socketLeave(socket, io)({ auth: auth1, payload: { conversationId } });

    expect(socket.leave).toHaveBeenCalledWith(conversationId);
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("socketSendMessage broadcasts dmNewMessage", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    const conversationId = await createConversationBetweenUser1AndUser2();

    await socketSendMessage(
      socket,
      io,
    )({
      auth: auth1,
      payload: { conversationId, text: "hello" },
    });

    expect(io.to).toHaveBeenCalledWith(conversationId);
    expect(io.emit).toHaveBeenCalledWith(
      "dmNewMessage",
      expect.objectContaining({
        conversationId,
        message: expect.objectContaining({
          text: "hello",
          sender: expect.objectContaining({ username: "user1" }),
        }),
      }),
    );
    expect(logSocketError).not.toHaveBeenCalled();
  });

  it("socketSendMessage logs errors when sender is not participant", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    const conversationId = await createConversationBetweenUser1AndUser2();

    await socketSendMessage(socket, io)({ auth: auth3, payload: { conversationId, text: "x" } });

    expect(logSocketError).toHaveBeenCalled();
  });
});
