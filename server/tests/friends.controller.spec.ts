import express from "express";
import supertest from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RestAPI } from "../src/types.ts";

vi.mock(import("../src/services/auth.service.ts"), () => ({
  checkAuth: vi.fn(),
}));

vi.mock(import("../src/services/friend.service.ts"), () => ({
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  declineFriendRequest: vi.fn(),
  getIncomingFriendRequests: vi.fn(),
  getOutgoingFriendRequests: vi.fn(),
  getCurrentFriends: vi.fn(),
  cancelFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
}));

import {
  postAccept,
  postCancel,
  postDecline,
  postFriends,
  postIncoming,
  postOutgoing,
  postRemove,
  postSend,
} from "../src/controllers/friends.controller.ts";
import { checkAuth } from "../src/services/auth.service.ts";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getCurrentFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
  removeFriend,
  sendFriendRequest,
} from "../src/services/friend.service.ts";

const auth = { username: "user1", password: "pwd1111" };
const user = { username: "user1", userId: "u1" };

const friendRequest = {
  id: "fr1",
  fromUsername: "user1",
  fromDisplay: "Yāo",
  toUsername: "user2",
  status: "pending" as const,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
};

const friendInfo = {
  username: "user2",
  display: "Sénior Dos",
  createdAt: new Date("2025-01-02T00:00:00.000Z"),
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/friend-request/send", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postSend))
      .post("/test")
      .send({ auth, payload: {} });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);
    const response = await supertest(restAppFor(postSend))
      .post("/test")
      .send({ auth, payload: { toUsername: "user2" } });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 for each service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    const errors = [
      "You cannot send a friend request to yourself",
      "User not found",
      "You are already friends with this user",
      "A pending friend request already exists between you and this user",
    ];

    for (const error of errors) {
      vi.mocked(sendFriendRequest).mockResolvedValueOnce({ error });
      const response = await supertest(restAppFor(postSend))
        .post("/test")
        .send({ auth, payload: { toUsername: "user2" } });
      expect(response.status).toBe(400);
      expect(response.body).toStrictEqual({ error });
    }
  });

  it("returns 201 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(sendFriendRequest).mockResolvedValue(friendRequest);

    const response = await supertest(restAppFor(postSend))
      .post("/test")
      .send({ auth, payload: { toUsername: "user2" } });

    expect(response.status).toBe(201);
    expect(response.body).toStrictEqual({
      ...friendRequest,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
  });
});

describe("POST /api/friend-request/accept", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postAccept))
      .post("/test")
      .send({ auth, payload: {} });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);
    const response = await supertest(restAppFor(postAccept))
      .post("/test")
      .send({ auth, payload: { requestId: "fr1" } });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 for each service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    const errors = [
      "Friend request not found",
      "You cannot accept this request",
      "Friend request already processed",
      "One or more users no longer exist",
    ];

    for (const error of errors) {
      vi.mocked(acceptFriendRequest).mockResolvedValueOnce({ error });
      const response = await supertest(restAppFor(postAccept))
        .post("/test")
        .send({ auth, payload: { requestId: "fr1" } });
      expect(response.status).toBe(400);
      expect(response.body).toStrictEqual({ error });
    }
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(acceptFriendRequest).mockResolvedValue(undefined);

    const response = await supertest(restAppFor(postAccept))
      .post("/test")
      .send({ auth, payload: { requestId: "fr1" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ ok: true });
  });
});

describe("POST /api/friend-request/decline", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postDecline))
      .post("/test")
      .send({ auth, payload: {} });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);
    const response = await supertest(restAppFor(postDecline))
      .post("/test")
      .send({ auth, payload: { requestId: "fr1" } });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 for each service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    const errors = [
      "Friend request not found",
      "You cannot decline this request",
      "Friend request already processed",
    ];

    for (const error of errors) {
      vi.mocked(declineFriendRequest).mockResolvedValueOnce({ error });
      const response = await supertest(restAppFor(postDecline))
        .post("/test")
        .send({ auth, payload: { requestId: "fr1" } });
      expect(response.status).toBe(400);
      expect(response.body).toStrictEqual({ error });
    }
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(declineFriendRequest).mockResolvedValue(undefined);

    const response = await supertest(restAppFor(postDecline))
      .post("/test")
      .send({ auth, payload: { requestId: "fr1" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ ok: true });
  });
});

describe("POST /api/friend-request/incoming", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postIncoming)).post("/test").send({ auth });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);
    const response = await supertest(restAppFor(postIncoming))
      .post("/test")
      .send({ auth, payload: {} });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(getIncomingFriendRequests).mockResolvedValue([friendRequest]);

    const response = await supertest(restAppFor(postIncoming))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([
      { ...friendRequest, createdAt: "2025-01-01T00:00:00.000Z" },
    ]);
  });
});

describe("POST /api/friend-request/outgoing", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postOutgoing)).post("/test").send({ auth });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);
    const response = await supertest(restAppFor(postOutgoing))
      .post("/test")
      .send({ auth, payload: {} });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(getOutgoingFriendRequests).mockResolvedValue([friendRequest]);

    const response = await supertest(restAppFor(postOutgoing))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([
      { ...friendRequest, createdAt: "2025-01-01T00:00:00.000Z" },
    ]);
  });
});

describe("POST /api/friend-request/friends", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postFriends)).post("/test").send({ auth });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);
    const response = await supertest(restAppFor(postFriends))
      .post("/test")
      .send({ auth, payload: {} });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 with service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(getCurrentFriends).mockResolvedValue({ error: "User not found" });

    const response = await supertest(restAppFor(postFriends))
      .post("/test")
      .send({ auth, payload: {} });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "User not found" });
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(getCurrentFriends).mockResolvedValue([friendInfo]);

    const response = await supertest(restAppFor(postFriends))
      .post("/test")
      .send({ auth, payload: {} });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([{ ...friendInfo, createdAt: "2025-01-02T00:00:00.000Z" }]);
  });
});

describe("POST /api/friend-request/cancel", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postCancel))
      .post("/test")
      .send({ auth, payload: {} });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);
    const response = await supertest(restAppFor(postCancel))
      .post("/test")
      .send({ auth, payload: { requestId: "fr1" } });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 for each service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    const errors = [
      "Friend request not found",
      "You cannot cancel this request",
      "Request already processed",
    ];

    for (const error of errors) {
      vi.mocked(cancelFriendRequest).mockResolvedValueOnce({ error });
      const response = await supertest(restAppFor(postCancel))
        .post("/test")
        .send({ auth, payload: { requestId: "fr1" } });
      expect(response.status).toBe(400);
      expect(response.body).toStrictEqual({ error });
    }
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(cancelFriendRequest).mockResolvedValue(undefined);

    const response = await supertest(restAppFor(postCancel))
      .post("/test")
      .send({ auth, payload: { requestId: "fr1" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ ok: true });
  });
});

describe("POST /api/friend-request/remove", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postRemove))
      .post("/test")
      .send({ auth, payload: {} });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);
    const response = await supertest(restAppFor(postRemove))
      .post("/test")
      .send({ auth, payload: { friendUsername: "user2" } });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 for each service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    const errors = [
      "User not found",
      "You cannot remove yourself",
      "You are not friends with this user",
    ];

    for (const error of errors) {
      vi.mocked(removeFriend).mockResolvedValueOnce({ error });
      const response = await supertest(restAppFor(postRemove))
        .post("/test")
        .send({ auth, payload: { friendUsername: "user2" } });
      expect(response.status).toBe(400);
      expect(response.body).toStrictEqual({ error });
    }
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(removeFriend).mockResolvedValue(undefined);

    const response = await supertest(restAppFor(postRemove))
      .post("/test")
      .send({ auth, payload: { friendUsername: "user2" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ ok: true });
  });
});
