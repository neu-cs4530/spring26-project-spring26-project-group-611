import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { getUserByUsername } from "../src/services/auth.service.ts";
import { UserRepo } from "../src/repository.ts";
import { joinGame } from "../src/services/game.service.ts";
import { app } from "../src/app.ts";

const auth3 = { username: "user3", password: "pwd3333" };

describe("Private Game Integration Flow", () => {
  const friendAuth = { username: "user2", password: "pwd2222" };

  it("should allow invited friend to join a private game", async () => {
    // Make user2 a friend of user3
    const host = await getUserByUsername("user3");
    const friend = await getUserByUsername("user2");
    if (!host || !friend) throw new Error("Missing users");

    const hostData = await UserRepo.get(host.userId);
    const friendData = await UserRepo.get(friend.userId);

    hostData.friends.push(friend.userId);
    friendData.friends.push(host.userId);

    await UserRepo.set(host.userId, hostData);
    await UserRepo.set(friend.userId, friendData);

    // Create PRIVATE game
    let res = await supertest(app)
      .post("/api/game/create")
      .send({
        auth: auth3,
        payload: { type: "nim", visibility: "private" },
      });

    expect(res.status).toBe(200);
    const gameId = res.body.gameId;
    if (typeof gameId !== "string") throw new Error("Invalid gameId");

    // Invite friend
    res = await supertest(app)
      .post("/api/game/invite")
      .send({
        auth: auth3,
        payload: { gameId, toUsername: "user2" },
      });

    expect(res.status).toBe(200);

    // Friend joins
    res = await supertest(app).post("/api/game/create").send();

    const joinResult = await joinGame(gameId, {
      userId: friend.userId,
      username: "user2",
    });

    expect(joinResult.players.some((p) => p.username === "user2")).toBe(true);
  });

  it("should reject non-invited user from joining private game", async () => {
    // Create private game
    const res = await supertest(app)
      .post("/api/game/create")
      .send({
        auth: auth3,
        payload: { type: "nim", visibility: "private" },
      });

    const gameId = res.body.gameId;
    if (typeof gameId !== "string") throw new Error("Invalid gameId");

    const stranger = await getUserByUsername("user1");
    if (!stranger) throw new Error("Missing user");

    await expect(
      joinGame(gameId, {
        userId: stranger.userId,
        username: "user1",
      }),
    ).rejects.toThrow("not invited");
  });

  it("should prevent non-host from inviting players", async () => {
    let res = await supertest(app)
      .post("/api/game/create")
      .send({
        auth: auth3,
        payload: { type: "nim", visibility: "private" },
      });

    const gameId = res.body.gameId;

    res = await supertest(app)
      .post("/api/game/invite")
      .send({
        auth: friendAuth, // NOT host
        payload: {
          gameId,
          toUsername: "user1",
        },
      });

    expect(res.status).toBe(400);
  });

  it("should prevent duplicate invites", async () => {
    const host = await getUserByUsername("user3");
    const friend = await getUserByUsername("user2");
    if (!host || !friend) throw new Error("Missing users");

    const hostData = await UserRepo.get(host.userId);
    if (!hostData.friends.includes(friend.userId)) {
      hostData.friends.push(friend.userId);
      await UserRepo.set(host.userId, hostData);
    }

    let res = await supertest(app)
      .post("/api/game/create")
      .send({
        auth: auth3,
        payload: { type: "nim", visibility: "private" },
      });

    const gameId = res.body.gameId;

    // First invite
    await supertest(app)
      .post("/api/game/invite")
      .send({
        auth: auth3,
        payload: { gameId, toUsername: "user2" },
      });

    // Duplicate invite
    res = await supertest(app)
      .post("/api/game/invite")
      .send({
        auth: auth3,
        payload: { gameId, toUsername: "user2" },
      });

    expect(res.status).toBe(400);
  });

  it("should prevent joining twice", async () => {
    const res = await supertest(app)
      .post("/api/game/create")
      .send({
        auth: auth3,
        payload: { type: "nim", visibility: "public" },
      });

    const gameId = res.body.gameId;
    if (typeof gameId !== "string") throw new Error("Invalid gameId");

    const host = await getUserByUsername("user3");
    if (!host) throw new Error("Missing user");

    await expect(
      joinGame(gameId, {
        userId: host.userId,
        username: "user3",
      }),
    ).rejects.toThrow("already");
  });
});
