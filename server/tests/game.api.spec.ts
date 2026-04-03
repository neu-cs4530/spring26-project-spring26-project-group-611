import { describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { app } from "../src/app.ts";
import { randomUUID } from "crypto";
import { UserRepo } from "../src/repository.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import { joinGame } from "../src/services/game.service.ts";

let response: Response;

const auth3 = { username: "user3", password: "pwd3333" };
const authBad = { username: "user3", password: "user3" };

describe("POST /api/game/create", () => {
  it("should return 400 on ill-formed payload or invalid game key", async () => {
    response = await supertest(app).post(`/api/game/create`).send({
      auth: auth3,
      payload: 9,
    });
    expect(response.status).toBe(400);

    response = await supertest(app)
      .post(`/api/game/create`)
      .send({ auth: auth3, payload: "gameThatDoesNotExist" });
    expect(response.status).toBe(400);
  });

  it("should return 403 with bad auth", async () => {
    response = await supertest(app)
      .post(`/api/game/create`)
      .send({ auth: authBad, payload: { type: "nim", visibility: "public" } });
    expect(response.status).toBe(403);
  });

  it("should succeed when asked to create a game of nim", async () => {
    response = await supertest(app)
      .post(`/api/game/create`)
      .send({
        auth: auth3,
        payload: { type: "nim", visibility: "public" },
      });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      gameId: expect.anything(),
      chat: expect.anything(),
      type: "nim",
      status: "waiting",
      visibility: "public",
      createdBy: {
        username: "user3",
        display: "Frau Drei",
        createdAt: expect.anything(),
      },
      createdAt: expect.anything(),
      minPlayers: 2,
      maxPlayers: 2,
      players: [
        {
          username: "user3",
          display: "Frau Drei",
          createdAt: expect.anything(),
        },
      ],
    });
  });
});

describe("GET /api/game/:id", () => {
  it("should 404 given a nonexistent id", async () => {
    response = await supertest(app).get(`/api/game/${randomUUID().toString()}`);
    expect(response.status).toBe(404);
  });

  it("should succeed if a created game is requested", async () => {
    response = await supertest(app)
      .post(`/api/game/create`)
      .send({
        auth: auth3,
        payload: { type: "nim", visibility: "public" },
      });
    expect(response.status).toBe(200);
    const gameInfo = response.body;

    response = await supertest(app).get(`/api/game/${gameInfo.gameId}`);
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual(gameInfo);
  });
});

describe("GET /api/game/list", () => {
  it("should return created games in reverse chronological order", async () => {
    response = await supertest(app).get(`/api/game/list`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject([
      {
        type: "nim",
        status: "waiting",
        players: [{ username: "user1" }],
      },
      {
        type: "guess",
        status: "active",
        players: [
          { username: "user1" },
          { username: "user0" },
          { username: "user3" },
          { username: "user2" },
        ],
      },
      {
        type: "nim",
        status: "done",
        createdAt: new Date("2025-04-21").toISOString(),
        players: [{ username: "user2" }, { username: "user3" }],
      },
    ]);
  });
});

describe("POST /api/game/kick", () => {
  it("should return 400 on ill-formed payload", async () => {
    response = await supertest(app).post(`/api/game/kick`).send({ auth: auth3, payload: 9 });
    expect(response.status).toBe(400);
  });

  it("should return 403 with bad auth", async () => {
    response = await supertest(app)
      .post(`/api/game/kick`)
      .send({ auth: authBad, payload: { gameId: "any", username: "user2" } });
    expect(response.status).toBe(403);
  });

  it("should return 400 when the game does not exist", async () => {
    response = await supertest(app)
      .post(`/api/game/kick`)
      .send({ auth: auth3, payload: { gameId: "nonexistent", username: "user2" } });
    expect(response.status).toBe(400);
  });

  it("should return 400 when the requester is not the host", async () => {
    // user3 creates a game
    response = await supertest(app)
      .post(`/api/game/create`)
      .send({ auth: auth3, payload: { type: "nim", visibility: "public" } });
    expect(response.status).toBe(200);
    const gameId = response.body.gameId;

    // user2 tries to kick — but user2 is not the host
    response = await supertest(app)
      .post(`/api/game/kick`)
      .send({
        auth: { username: "user2", password: "pwd2222" },
        payload: { gameId, username: "user3" },
      });
    expect(response.status).toBe(400);
  });

  it("should return 400 when the target is not in the game", async () => {
    response = await supertest(app)
      .post(`/api/game/create`)
      .send({ auth: auth3, payload: { type: "nim", visibility: "public" } });
    const gameId = response.body.gameId;

    response = await supertest(app)
      .post(`/api/game/kick`)
      .send({ auth: auth3, payload: { gameId, username: "user1" } });
    expect(response.status).toBe(400);
  });

  it("should return 400 when the host tries to kick themselves", async () => {
    response = await supertest(app)
      .post(`/api/game/create`)
      .send({ auth: auth3, payload: { type: "nim", visibility: "public" } });
    const gameId = response.body.gameId;

    response = await supertest(app)
      .post(`/api/game/kick`)
      .send({ auth: auth3, payload: { gameId, username: "user3" } });
    expect(response.status).toBe(400);
  });

  it("should successfully kick a player from the waiting room", async () => {
    // user3 creates a public game
    response = await supertest(app)
      .post(`/api/game/create`)
      .send({ auth: auth3, payload: { type: "guess", visibility: "public" } });
    expect(response.status).toBe(200);
    const gameId: string = response.body.gameId as string;

    // user2 joins the game directly via the service
    const user2 = await getUserByUsername("user2");
    if (!user2) throw new Error("user2 not found");
    await joinGame(gameId, { userId: user2.userId, username: "user2" });

    // host kicks user2
    response = await supertest(app)
      .post(`/api/game/kick`)
      .send({ auth: auth3, payload: { gameId, username: "user2" } });
    expect(response.status).toBe(200);
    const usernames = (response.body as { players: { username: string }[] }).players.map(
      (p) => p.username,
    );
    expect(usernames).not.toContain("user2");
    expect(usernames).toContain("user3");
  });
});

describe("POST /api/game/invite", () => {
  it("should reject inviting users who are not already friends", async () => {
    response = await supertest(app)
      .post(`/api/game/create`)
      .send({
        auth: auth3,
        payload: { type: "nim", visibility: "public" },
      });
    expect(response.status).toBe(200);
    const gameId = response.body.gameId;

    response = await supertest(app)
      .post(`/api/game/invite`)
      .send({
        auth: auth3,
        payload: {
          gameId,
          toUsername: "user2",
        },
      });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({
      error: "You can only invite friends to a private game",
    });
  });

  it("should allow inviting users who are already friends", async () => {
    const hostAuth = await getUserByUsername("user3");
    const friendAuth = await getUserByUsername("user2");
    if (!hostAuth || !friendAuth) {
      throw new Error("Expected seed users to exist");
    }

    const host = await UserRepo.get(hostAuth.userId);
    const friend = await UserRepo.get(friendAuth.userId);
    host.friends = [...host.friends, friendAuth.userId];
    friend.friends = [...friend.friends, hostAuth.userId];
    await UserRepo.set(hostAuth.userId, host);
    await UserRepo.set(friendAuth.userId, friend);

    response = await supertest(app)
      .post(`/api/game/create`)
      .send({
        auth: auth3,
        payload: { type: "nim", visibility: "public" },
      });
    expect(response.status).toBe(200);
    const gameId = response.body.gameId;

    response = await supertest(app)
      .post(`/api/game/invite`)
      .send({
        auth: auth3,
        payload: {
          gameId,
          toUsername: "user2",
        },
      });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      gameId,
      toUsername: "user2",
    });
  });
});
