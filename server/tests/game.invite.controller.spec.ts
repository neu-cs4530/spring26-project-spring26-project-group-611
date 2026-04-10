import express from "express";
import supertest from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RestAPI } from "../src/types.ts";

vi.mock(import("../src/services/auth.service.ts"), () => ({
  checkAuth: vi.fn(),
}));

vi.mock(import("../src/services/game.invite.service.ts"), () => ({
  sendGameInvite: vi.fn(),
  getInvitesForUser: vi.fn(),
  getInvitesSentByUser: vi.fn(),
  toggleAcceptGameInvites: vi.fn(),
  acceptInvite: vi.fn(),
  declineInvite: vi.fn(),
}));

vi.mock(import("../src/services/game.service.ts"), () => ({
  getGameById: vi.fn(),
}));

vi.mock(import("../src/controllers/game.controller.ts"), () => ({
  emitGamePlayersUpdated: vi.fn(),
  emitGameInvitesUpdated: vi.fn(),
}));

import {
  postAccept,
  postDecline,
  postIncoming,
  postOutgoing,
  postSend,
  postToggleAccept,
} from "../src/controllers/game.invite.controller.ts";
import { checkAuth } from "../src/services/auth.service.ts";
import {
  acceptInvite,
  declineInvite,
  getInvitesForUser,
  getInvitesSentByUser,
  sendGameInvite,
  toggleAcceptGameInvites,
} from "../src/services/game.invite.service.ts";
import { getGameById } from "../src/services/game.service.ts";
import {
  emitGamePlayersUpdated,
  emitGameInvitesUpdated,
} from "../src/controllers/game.controller.ts";

const auth = { username: "user3", password: "pwd3333" };
const authedUser = { username: "user3", userId: "u3" };

const inviteInfo = {
  inviteId: "inv1",
  gameId: "g1",
  fromUsername: "user3",
  toUsername: "user2",
  status: "pending" as const,
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
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

describe("POST /api/game-invite/send", () => {
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
      .send({ auth, payload: { gameId: "g1", toUsername: "user2" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 with service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(sendGameInvite).mockResolvedValue({ error: "Game not found" });

    const response = await supertest(restAppFor(postSend))
      .post("/test")
      .send({ auth, payload: { gameId: "g1", toUsername: "user2" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Game not found" });
  });

  it("returns 201 on success", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(sendGameInvite).mockResolvedValue(inviteInfo);

    const response = await supertest(restAppFor(postSend))
      .post("/test")
      .send({ auth, payload: { gameId: "g1", toUsername: "user2" } });

    expect(response.status).toBe(201);
    expect(response.body).toStrictEqual({
      ...inviteInfo,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(emitGameInvitesUpdated).toHaveBeenCalledExactlyOnceWith("user2");
  });
});

describe("POST /api/game-invite/incoming", () => {
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

  it("returns 200 on success", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(getInvitesForUser).mockResolvedValue([inviteInfo]);

    const response = await supertest(restAppFor(postIncoming))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([
      {
        ...inviteInfo,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("POST /api/game-invite/outgoing", () => {
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

  it("returns 200 on success", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(getInvitesSentByUser).mockResolvedValue([inviteInfo]);

    const response = await supertest(restAppFor(postOutgoing))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([
      {
        ...inviteInfo,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("POST /api/game-invite/toggle-accept", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor(postToggleAccept)).post("/test").send({ auth });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);

    const response = await supertest(restAppFor(postToggleAccept))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 with service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(toggleAcceptGameInvites).mockResolvedValue({ error: "User not found" });

    const response = await supertest(restAppFor(postToggleAccept))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "User not found" });
  });

  it("returns 201 on success", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(toggleAcceptGameInvites).mockResolvedValue({ acceptGameInvites: false });

    const response = await supertest(restAppFor(postToggleAccept))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(201);
    expect(response.body).toStrictEqual({ acceptGameInvites: false });
  });
});

describe("POST /api/game-invite/accept", () => {
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
      .send({ auth, payload: { inviteId: "inv1" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 with service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(acceptInvite).mockResolvedValue({ error: "Invite not found" });

    const response = await supertest(restAppFor(postAccept))
      .post("/test")
      .send({ auth, payload: { inviteId: "inv1" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Invite not found" });
  });

  it("returns 200 on success and emits players update when game exists", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(acceptInvite).mockResolvedValue({ ...inviteInfo, status: "accepted" });
    vi.mocked(getGameById).mockResolvedValue({
      gameId: "g1",
      players: [
        {
          username: "user3",
          display: "Frau Drei",
          createdAt: new Date("2025-01-01T00:00:00.000Z"),
          acceptGameInvites: true,
        },
      ],
    } as never);

    const response = await supertest(restAppFor(postAccept))
      .post("/test")
      .send({ auth, payload: { inviteId: "inv1" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...inviteInfo,
      status: "accepted",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(emitGamePlayersUpdated).toHaveBeenCalledExactlyOnceWith("g1", expect.any(Array));
    expect(emitGameInvitesUpdated).toHaveBeenCalledTimes(2);
    expect(emitGameInvitesUpdated).toHaveBeenNthCalledWith(1, "user2");
    expect(emitGameInvitesUpdated).toHaveBeenNthCalledWith(2, "user3");
  });
});

describe("POST /api/game-invite/decline", () => {
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
      .send({ auth, payload: { inviteId: "inv1" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 with service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(declineInvite).mockResolvedValue({ error: "Invite not found" });

    const response = await supertest(restAppFor(postDecline))
      .post("/test")
      .send({ auth, payload: { inviteId: "inv1" } });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Invite not found" });
  });

  it("returns 200 on success", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(declineInvite).mockResolvedValue({ ...inviteInfo, status: "declined" });

    const response = await supertest(restAppFor(postDecline))
      .post("/test")
      .send({ auth, payload: { inviteId: "inv1" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...inviteInfo,
      status: "declined",
      createdAt: "2025-01-01T00:00:00.000Z",
    });
    expect(emitGameInvitesUpdated).toHaveBeenCalledTimes(2);
    expect(emitGameInvitesUpdated).toHaveBeenNthCalledWith(1, "user2");
    expect(emitGameInvitesUpdated).toHaveBeenNthCalledWith(2, "user3");
  });
});
