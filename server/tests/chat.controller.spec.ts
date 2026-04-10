import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket } from "../src/types.ts";

vi.mock(import("../src/services/auth.service.ts"), () => ({
  enforceAuth: vi.fn(),
}));

vi.mock(import("../src/services/chat.service.ts"), () => ({
  addMessageToChat: vi.fn(),
  forceChatById: vi.fn(),
}));

vi.mock(import("../src/services/user.service.ts"), () => ({
  populateSafeUserInfo: vi.fn(),
}));

vi.mock(import("../src/services/message.service.ts"), () => ({
  createMessage: vi.fn(),
}));

vi.mock(import("../src/controllers/socket.controller.ts"), () => ({
  logSocketError: vi.fn(),
}));

import { socketJoin, socketLeave, socketSendMessage } from "../src/controllers/chat.controller.ts";
import { enforceAuth } from "../src/services/auth.service.ts";
import { addMessageToChat, forceChatById } from "../src/services/chat.service.ts";
import { populateSafeUserInfo } from "../src/services/user.service.ts";
import { createMessage } from "../src/services/message.service.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";

const auth = { username: "user1", password: "pwd1111" };
const user = { username: "user1", userId: "u1" };
const safeUser = {
  username: "user1",
  display: "Yao",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  acceptGameInvites: true,
};
const chat = {
  chatId: "c1",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  messages: [],
  moveLog: [],
};
const message = {
  messageId: "m1",
  text: "hello",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  createdBy: safeUser,
};

class MockGameServer {
  to = vi.fn(() => this);
  emit = vi.fn();
}

class MockGameServerSocket {
  id = "mock-socket";
  rooms = new Set<string>();
  join = vi.fn((room: string) => {
    this.rooms.add(room);
  });
  leave = vi.fn((room: string) => {
    this.rooms.delete(room);
  });
  emit = vi.fn();
  to = vi.fn(() => this);
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("chat sockets", () => {
  it("socketJoin parse failure logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketJoin(socket, io)({ auth, payload: 3 });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("socketJoin invalid auth logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockRejectedValue(new Error("Invalid auth"));

    await socketJoin(socket, io)({ auth, payload: "c1" });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("socketJoin service error from forceChatById logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(forceChatById).mockRejectedValue(new Error("user user1 accessed invalid chat id"));

    await socketJoin(socket, io)({ auth, payload: "c1" });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.emit).not.toHaveBeenCalledWith("chatJoined", expect.anything());
  });

  it("socketJoin service error from populateSafeUserInfo logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(forceChatById).mockResolvedValue(chat);
    vi.mocked(populateSafeUserInfo).mockRejectedValue(new Error("invalid user id"));

    await socketJoin(socket, io)({ auth, payload: "c1" });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.emit).toHaveBeenCalledWith("chatJoined", chat);
  });

  it("socketJoin happy path joins room and emits joined/userJoined", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(forceChatById).mockResolvedValue(chat);
    vi.mocked(populateSafeUserInfo).mockResolvedValue(safeUser);

    await socketJoin(socket, io)({ auth, payload: "c1" });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledExactlyOnceWith("c1");
    expect(socket.emit).toHaveBeenCalledWith("chatJoined", chat);
    expect(socket.to).toHaveBeenCalledExactlyOnceWith("c1");
    expect(socket.emit).toHaveBeenCalledWith("chatUserJoined", { chatId: "c1", user: safeUser });
  });

  it("socketLeave parse failure logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketLeave(socket, io)({ auth, payload: 3 });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it("socketLeave invalid auth logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockRejectedValue(new Error("Invalid auth"));

    await socketLeave(socket, io)({ auth, payload: "c1" });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it("socketLeave service error when user leaves chat they are not in", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockResolvedValue(user);

    await socketLeave(socket, io)({ auth, payload: "c1" });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it("socketLeave service error from populateSafeUserInfo logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    socket.rooms.add("c1");
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(populateSafeUserInfo).mockRejectedValue(new Error("invalid user id"));

    await socketLeave(socket, io)({ auth, payload: "c1" });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.leave).toHaveBeenCalledExactlyOnceWith("c1");
  });

  it("socketLeave happy path leaves room and emits userLeft", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    socket.rooms.add("c1");
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(populateSafeUserInfo).mockResolvedValue(safeUser);

    await socketLeave(socket, io)({ auth, payload: "c1" });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(socket.leave).toHaveBeenCalledExactlyOnceWith("c1");
    expect(socket.to).toHaveBeenCalledExactlyOnceWith("c1");
    expect(socket.emit).toHaveBeenCalledWith("chatUserLeft", { chatId: "c1", user: safeUser });
  });

  it("socketSendMessage parse failure logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketSendMessage(socket, io)({ auth, payload: { chatId: "c1" } });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(io.emit).not.toHaveBeenCalled();
  });

  it("socketSendMessage invalid auth logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockRejectedValue(new Error("Invalid auth"));

    await socketSendMessage(socket, io)({ auth, payload: { chatId: "c1", text: "hello" } });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(io.emit).not.toHaveBeenCalled();
  });

  it("socketSendMessage service error from createMessage logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(createMessage).mockRejectedValue(new Error("create failed"));

    await socketSendMessage(socket, io)({ auth, payload: { chatId: "c1", text: "hello" } });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(io.emit).not.toHaveBeenCalled();
  });

  it("socketSendMessage service error from addMessageToChat logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(createMessage).mockResolvedValue(message);
    vi.mocked(addMessageToChat).mockRejectedValue(new Error("user user1 sent to invalid chat id"));

    await socketSendMessage(socket, io)({ auth, payload: { chatId: "c1", text: "hello" } });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(io.emit).not.toHaveBeenCalled();
  });

  it("socketSendMessage happy path emits chatNewMessage", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(createMessage).mockResolvedValue(message);
    vi.mocked(addMessageToChat).mockResolvedValue(chat);

    await socketSendMessage(socket, io)({ auth, payload: { chatId: "c1", text: "hello" } });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(io.to).toHaveBeenCalledExactlyOnceWith("c1");
    expect(io.emit).toHaveBeenCalledExactlyOnceWith("chatNewMessage", { chatId: "c1", message });
  });
});
