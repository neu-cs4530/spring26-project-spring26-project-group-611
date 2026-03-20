import { describe, expect, it } from "vitest";
import { GameRepo } from "../../src/repository.ts";
import { getUserByUsername } from "../../src/services/auth.service.ts";
import { getProfileStats } from "../../src/services/profileStats.service.ts";

describe("getProfileStats", () => {
  it("should return empty stats when no valid finished games exist", async () => {
    const stats = await getProfileStats("user1");

    expect(stats.games).toEqual([]);
    expect(stats.favoriteGame).toBeNull();
    expect(stats.overallWinRate).toBe(0);
  });

  it("should compute stats when finished games exist", async () => {
    const user1 = await getUserByUsername("user1");
    if (!user1) throw new Error("user1 not found");

    const now = new Date();

    await GameRepo.set("g1", {
      type: "nim",
      done: true,
      players: [user1.userId],
      createdAt: now.toISOString(),
      createdBy: user1.userId,
      chat: "chat1",
      finishedAt: now.toISOString(),
      winnerUserIds: [user1.userId],
    });

    await GameRepo.set("g2", {
      type: "nim",
      done: true,
      players: [user1.userId],
      createdAt: now.toISOString(),
      createdBy: user1.userId,
      chat: "chat2",
      finishedAt: new Date(now.getTime() - 1000).toISOString(),
      winnerUserIds: [],
    });

    const stats = await getProfileStats(user1.userId);

    expect(stats.games.length).toBe(2);

    // win rate
    expect(stats.overallWinRate).toBe(0.5);

    // favorite game
    expect(stats.favoriteGame).toBe("nim");

    // streak logic
    expect(stats.games[0].streak).toBe(1);
    expect(stats.games[1].streak).toBe(1); // win → loss resets
  });

  it("should calculate streak correctly for consecutive wins", async () => {
    const user1 = await getUserByUsername("user1");
    if (!user1) throw new Error("user1 not found");

    const now = new Date();

    await GameRepo.set("g1", {
      type: "nim",
      done: true,
      players: [user1.userId],
      createdAt: now.toISOString(),
      createdBy: user1.userId,
      chat: "chat1",
      finishedAt: now.toISOString(),
      winnerUserIds: [user1.userId],
    });

    await GameRepo.set("g2", {
      type: "nim",
      done: true,
      players: [user1.userId],
      createdAt: now.toISOString(),
      createdBy: user1.userId,
      chat: "chat2",
      finishedAt: new Date(now.getTime() - 1000).toISOString(),
      winnerUserIds: [user1.userId],
    });

    const stats = await getProfileStats(user1.userId);

    expect(stats.games[0].streak).toBe(1);
    expect(stats.games[1].streak).toBe(2);
  });

  it("should return 0 win rate when user loses all games", async () => {
    const user1 = await getUserByUsername("user1");
    if (!user1) throw new Error("user1 not found");

    const now = new Date();

    await GameRepo.set("g1", {
      type: "nim",
      done: true,
      players: [user1.userId],
      createdAt: now.toISOString(),
      createdBy: user1.userId,
      chat: "chat1",
      finishedAt: now.toISOString(),
      winnerUserIds: [], // lost
    });

    const stats = await getProfileStats(user1.userId);

    expect(stats.overallWinRate).toBe(0);
  });

  it("should return 1 win rate when user wins all games", async () => {
    const user1 = await getUserByUsername("user1");
    if (!user1) throw new Error("user1 not found");

    const now = new Date();

    await GameRepo.set("g1", {
      type: "nim",
      done: true,
      players: [user1.userId],
      createdAt: now.toISOString(),
      createdBy: user1.userId,
      chat: "chat1",
      finishedAt: now.toISOString(),
      winnerUserIds: [user1.userId],
    });

    const stats = await getProfileStats(user1.userId);

    expect(stats.overallWinRate).toBe(1);
  });

  it("should ignore games missing finishedAt or winnerUserIds", async () => {
    const user1 = await getUserByUsername("user1");
    if (!user1) throw new Error("user1 not found");

    await GameRepo.set("g1", {
      type: "nim",
      done: true,
      players: [user1.userId],
      createdAt: new Date().toISOString(),
      createdBy: user1.userId,
      chat: "chat1",
      // missing finishedAt + winnerUserIds
    });

    const stats = await getProfileStats(user1.userId);

    expect(stats.games.length).toBe(0);
  });

  it("should pick the first game type in case of tie", async () => {
    const user1 = await getUserByUsername("user1");
    if (!user1) throw new Error("user1 not found");

    const now = new Date();

    await GameRepo.set("g1", {
      type: "nim",
      done: true,
      players: [user1.userId],
      createdAt: now.toISOString(),
      createdBy: user1.userId,
      chat: "chat1",
      finishedAt: now.toISOString(),
      winnerUserIds: [],
    });

    await GameRepo.set("g2", {
      type: "guess",
      done: true,
      players: [user1.userId],
      createdAt: now.toISOString(),
      createdBy: user1.userId,
      chat: "chat2",
      finishedAt: new Date(now.getTime() - 1000).toISOString(),
      winnerUserIds: [],
    });

    const stats = await getProfileStats(user1.userId);

    expect(stats.favoriteGame).toBe("nim"); // first encountered
  });

  it("should ignore games where user is not a player", async () => {
    const user1 = await getUserByUsername("user1");
    const user2 = await getUserByUsername("user2");
    if (!user1 || !user2) throw new Error("users not found");

    const now = new Date();

    await GameRepo.set("g1", {
      type: "nim",
      done: true,
      players: [user2.userId], // NOT user1
      createdAt: now.toISOString(),
      createdBy: user2.userId,
      chat: "chat1",
      finishedAt: now.toISOString(),
      winnerUserIds: [user2.userId],
    });

    const stats = await getProfileStats(user1.userId);

    expect(stats.games.length).toBe(0);
  });
});
