import express from "express";
import supertest from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameServer, GameServerSocket, RestAPI } from "../src/types.ts";

vi.mock(import("../src/services/auth.service.ts"), () => ({
  checkAuth: vi.fn(),
  enforceAuth: vi.fn(),
}));

vi.mock(import("../src/services/dm.service.ts"), () => ({
  getOrCreateConversation: vi.fn(),
  sendDirectMessage: vi.fn(),
  getMessages: vi.fn(),
}));

vi.mock(import("../src/controllers/socket.controller.ts"), () => ({
  logSocketError: vi.fn(),
}));

import {
  postMessages,
  postSend,
  postStart,
  socketJoin,
  socketLeave,
  socketSendMessage,
} from "../src/controllers/dm.controller.ts";
import { checkAuth, enforceAuth } from "../src/services/auth.service.ts";
import {
  getMessages,
  getOrCreateConversation,
  sendDirectMessage,
} from "../src/services/dm.service.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";

const auth = { username: "user1", password: "pwd1111" };
const user = { username: "user1", userId: "u1" };

const safeUser = {
  username: "user1",
  display: "Yao",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  acceptGameInvites: true,
};

function restAppFor(handler: RestAPI) {
  const app = express();
  app.use(express.json());
  app.post("/test", (req, res) => {
    void handler(req as never, res as never);
  });
  return app;
}

class MockGameServer {
  to = vi.fn(() => this);
  emit = vi.fn();
}

class MockGameServerSocket {
  id = "mock-socket";
  join = vi.fn();
  leave = vi.fn();
  emit = vi.fn();
  to = vi.fn(() => this);
}

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/dm/start", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postStart))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Bad request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);

    const response = await supertest(restAppFor(postStart))
      .post("/test")
      .send({ auth, payload: { username: "user2" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid auth" });
  });

  it("returns 400 with service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(getOrCreateConversation).mockResolvedValue({ error: "You can only message friends" });

    const response = await supertest(restAppFor(postStart))
      .post("/test")
      .send({ auth, payload: { username: "user2" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "You can only message friends" });
  });

  it("returns 200 on success", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(getOrCreateConversation).mockResolvedValue({ id: "c1" });

    const response = await supertest(restAppFor(postStart))
      .post("/test")
      .send({ auth, payload: { username: "user2" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ id: "c1" });
  });
});

describe("POST /api/dm/send", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postSend))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Bad request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);

    const response = await supertest(restAppFor(postSend))
      .post("/test")
      .send({ auth, payload: { conversationId: "c1", text: "hello" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid auth" });
  });

  it("returns 400 with service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(sendDirectMessage).mockResolvedValue({ error: "Conversation not found" });

    const response = await supertest(restAppFor(postSend))
      .post("/test")
      .send({ auth, payload: { conversationId: "c1", text: "hello" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Conversation not found" });
  });

  it("returns 200 on success", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(sendDirectMessage).mockResolvedValue({
      id: "m1",
      text: "hello",
      sender: safeUser,
      createdAt: new Date("2025-01-02T00:00:00.000Z"),
    });

    const response = await supertest(restAppFor(postSend))
      .post("/test")
      .send({ auth, payload: { conversationId: "c1", text: "hello" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      id: "m1",
      text: "hello",
      sender: { ...safeUser, createdAt: safeUser.createdAt.toISOString() },
      createdAt: "2025-01-02T00:00:00.000Z",
    });
  });
});

describe("POST /api/dm/messages", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postMessages))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Bad request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);

    const response = await supertest(restAppFor(postMessages))
      .post("/test")
      .send({ auth, payload: { conversationId: "c1" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid auth" });
  });

  it("returns 400 with service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(getMessages).mockResolvedValue({ error: "Not authorized" });

    const response = await supertest(restAppFor(postMessages))
      .post("/test")
      .send({ auth, payload: { conversationId: "c1" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Not authorized" });
  });

  it("returns 200 on success", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(getMessages).mockResolvedValue([
      {
        id: "m1",
        text: "hello",
        sender: safeUser,
        createdAt: new Date("2025-01-02T00:00:00.000Z"),
      },
    ]);

    const response = await supertest(restAppFor(postMessages))
      .post("/test")
      .send({ auth, payload: { conversationId: "c1" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([
      {
        id: "m1",
        text: "hello",
        sender: { ...safeUser, createdAt: safeUser.createdAt.toISOString() },
        createdAt: "2025-01-02T00:00:00.000Z",
      },
    ]);
  });
});

describe("dm sockets", () => {
  it("socketJoin parse failure logs error and does not emit", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketJoin(socket, io)({});

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("socketJoin enforceAuth failure logs error and does not emit", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockRejectedValue(new Error("Invalid auth"));

    await socketJoin(socket, io)({ auth, payload: { conversationId: "c1" } });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("socketJoin success joins room and emits dmJoined", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(getMessages).mockResolvedValue([
      {
        id: "m1",
        text: "hello",
        sender: safeUser,
        createdAt: new Date("2025-01-02T00:00:00.000Z"),
      },
    ]);

    await socketJoin(socket, io)({ auth, payload: { conversationId: "c1" } });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(socket.join).toHaveBeenCalledExactlyOnceWith("c1");
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith("dmJoined", {
      conversationId: "c1",
      messages: [
        {
          id: "m1",
          text: "hello",
          sender: safeUser,
          createdAt: new Date("2025-01-02T00:00:00.000Z"),
        },
      ],
    });
  });

  it("socketSendMessage parse failure logs error and does not emit", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketSendMessage(socket, io)({ auth, payload: { conversationId: "c1" } });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(io.to).not.toHaveBeenCalled();
  });

  it("socketSendMessage enforceAuth failure logs error and does not emit", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockRejectedValue(new Error("Invalid auth"));

    await socketSendMessage(socket, io)({ auth, payload: { conversationId: "c1", text: "hello" } });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(io.to).not.toHaveBeenCalled();
  });

  it("socketSendMessage success emits dmNewMessage to room", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(sendDirectMessage).mockResolvedValue({
      id: "m1",
      text: "hello",
      sender: safeUser,
      createdAt: new Date("2025-01-02T00:00:00.000Z"),
    });

    await socketSendMessage(socket, io)({ auth, payload: { conversationId: "c1", text: "hello" } });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(io.to).toHaveBeenCalledExactlyOnceWith("c1");
    expect(io.emit).toHaveBeenCalledExactlyOnceWith("dmNewMessage", {
      conversationId: "c1",
      message: {
        id: "m1",
        text: "hello",
        sender: safeUser,
        createdAt: new Date("2025-01-02T00:00:00.000Z"),
      },
    });
  });

  it("socketLeave parse failure logs error and does not emit", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketLeave(socket, io)({});

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it("socketLeave enforceAuth failure logs error and does not emit", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockRejectedValue(new Error("Invalid auth"));

    await socketLeave(socket, io)({ auth, payload: { conversationId: "c1" } });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.leave).not.toHaveBeenCalled();
  });

  it("socketLeave success leaves room", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockResolvedValue(user);

    await socketLeave(socket, io)({ auth, payload: { conversationId: "c1" } });

    expect(logSocketError).not.toHaveBeenCalled();
    expect(socket.leave).toHaveBeenCalledExactlyOnceWith("c1");
  });
});
