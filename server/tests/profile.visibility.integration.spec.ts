import { afterEach, beforeEach, describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { app } from "../src/app.ts";
import { createUser } from "../src/services/user.service.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import { createChat } from "../src/services/chat.service.ts";
import { AuthRepo, ChatRepo, GameRepo, UserRepo } from "../src/repository.ts";
import type { GameKey } from "@gamenite/shared";

type UserAuth = {
  username: string;
  password: string;
};

const selfAuth: UserAuth = { username: "stats-self", password: "stats-self-pass" };
const friendAuth: UserAuth = { username: "stats-friend", password: "stats-friend-pass" };
const nonFriendAuth: UserAuth = { username: "stats-nonfriend", password: "stats-nonfriend-pass" };

let selfUserId = "";
let friendUserId = "";

let createdGameIds: string[] = [];
let createdChatIds: string[] = [];

async function ensureUserCreated(username: string, password: string): Promise<void> {
  const result = await createUser(username, password, new Date());
  if ("error" in result) {
    throw new Error(`Failed to create fixture user ${username}: ${result.error}`);
  }
}

async function setAsFriends(usernameA: string, usernameB: string): Promise<void> {
  const userA = await getUserByUsername(usernameA);
  const userB = await getUserByUsername(usernameB);
  if (!userA || !userB) {
    throw new Error("Expected fixture users to exist");
  }

  const recordA = await UserRepo.get(userA.userId);
  const recordB = await UserRepo.get(userB.userId);

  recordA.friends = [...new Set([...(recordA.friends ?? []), userB.userId])];
  recordB.friends = [...new Set([...(recordB.friends ?? []), userA.userId])];

  await UserRepo.set(userA.userId, recordA);
  await UserRepo.set(userB.userId, recordB);
}

async function addFinishedGame(
  type: GameKey,
  finishedAt: Date,
  didSelfWin: boolean,
): Promise<string> {
  const chat = await createChat(finishedAt);
  createdChatIds.push(chat.chatId);

  const gameId = await GameRepo.add({
    type,
    done: true,
    chat: chat.chatId,
    createdAt: new Date(finishedAt.getTime() - 60_000).toISOString(),
    createdBy: selfUserId,
    players: [selfUserId, friendUserId],
    finishedAt: finishedAt.toISOString(),
    winnerUserIds: didSelfWin ? [selfUserId] : [friendUserId],
  });

  createdGameIds.push(gameId);
  return gameId;
}

async function setStatsMode(mode: "public" | "friends-only" | "private") {
  const canViewStats = mode === "public";
  const response = await supertest(app)
    .post(`/api/user/${selfAuth.username}`)
    .send({ auth: selfAuth, payload: { canViewStats } });
  expect(response.status).toBe(200);
}

async function viewProfileAs(auth: UserAuth): Promise<Response> {
  return supertest(app).post(`/api/user/${selfAuth.username}/view`).send({ auth, payload: {} });
}

async function safeDeleteFixtureUsers(usernames: string[]) {
  for (const username of usernames) {
    const auth = await AuthRepo.find(username);
    if (!auth) {
      continue;
    }

    if (await UserRepo.find(auth.userId)) {
      await UserRepo.delete(auth.userId);
    }
    await AuthRepo.delete(username);
  }
}

async function safeDeleteFixtureGames(gameIds: string[]) {
  for (const gameId of gameIds) {
    if (await GameRepo.find(gameId)) {
      await GameRepo.delete(gameId);
    }
  }
}

async function safeDeleteFixtureChats(chatIds: string[]) {
  for (const chatId of chatIds) {
    if (await ChatRepo.find(chatId)) {
      await ChatRepo.delete(chatId);
    }
  }
}

function expectedRunningStreaks(games: Array<{ gameId: string; didWin: boolean }>): Map<string, number> {
  const expected = new Map<string, number>();

  let streak = 0;
  let lastResult: boolean | null = null;

  for (const game of games) {
    if (lastResult === game.didWin) {
      streak += 1;
    } else {
      streak = 1;
      lastResult = game.didWin;
    }

    expected.set(game.gameId, streak);
  }

  return expected;
}

describe("POST /api/user/:username/view profile integration", () => {
  let fixtureNimNewest = "";
  let fixtureGuessMiddle = "";
  let fixtureNimMiddle = "";
  let fixtureNimOldest = "";

  beforeEach(async () => {
    createdGameIds = [];
    createdChatIds = [];

    await ensureUserCreated(selfAuth.username, selfAuth.password);
    await ensureUserCreated(friendAuth.username, friendAuth.password);
    await ensureUserCreated(nonFriendAuth.username, nonFriendAuth.password);

    const selfUser = await getUserByUsername(selfAuth.username);
    const friendUser = await getUserByUsername(friendAuth.username);
    const nonFriendUser = await getUserByUsername(nonFriendAuth.username);

    if (!selfUser || !friendUser || !nonFriendUser) {
      throw new Error("Expected fixture users to exist");
    }

    selfUserId = selfUser.userId;
    friendUserId = friendUser.userId;
    await setAsFriends(selfAuth.username, friendAuth.username);

    fixtureNimOldest = await addFinishedGame("nim", new Date("2026-01-01T10:00:00.000Z"), false);
    fixtureNimMiddle = await addFinishedGame("nim", new Date("2026-01-02T10:00:00.000Z"), true);
    fixtureGuessMiddle = await addFinishedGame(
      "guess",
      new Date("2026-01-03T10:00:00.000Z"),
      false,
    );
    fixtureNimNewest = await addFinishedGame("nim", new Date("2026-01-04T10:00:00.000Z"), true);
  });

  afterEach(async () => {
    await safeDeleteFixtureGames(createdGameIds);
    await safeDeleteFixtureChats(createdChatIds);
    await safeDeleteFixtureUsers([selfAuth.username, friendAuth.username, nonFriendAuth.username]);
  });

  it("Self can view own profile stats and personal info", async () => {
    await setStatsMode("public");
    const response = await viewProfileAs(selfAuth);

    expect(response.status).toBe(200);
    expect(response.body.username).toBe(selfAuth.username);
    expect(response.body.display).toBe(selfAuth.username);
    expect(response.body.createdAt).not.toBeNull();
    expect(response.body.canViewStats).toBe(true);
    expect(response.body.stats).not.toBeNull();
  });

  it("Friend can view personal info and stats when owner sets friends-only", async () => {
    await setStatsMode("friends-only");
    const response = await viewProfileAs(friendAuth);

    expect(response.status).toBe(200);
    expect(response.body.areFriends).toBe(true);
    expect(response.body.createdAt).not.toBeNull();
    expect(response.body.canViewStats).toBe(true);
    expect(response.body.stats).not.toBeNull();
  });

  it("Non-friend can view stats when owner stats are public", async () => {
    await setStatsMode("public");
    const response = await viewProfileAs(nonFriendAuth);

    expect(response.status).toBe(200);
    expect(response.body.areFriends).toBe(false);
    expect(response.body.createdAt).toBeNull();
    expect(response.body.canViewStats).toBe(true);
    expect(response.body.stats).not.toBeNull();
  });

  it("Non-friend sees only basic info when owner stats are friends-only", async () => {
    await setStatsMode("friends-only");
    const response = await viewProfileAs(nonFriendAuth);

    expect(response.status).toBe(200);
    expect(response.body.username).toBe(selfAuth.username);
    expect(response.body.display).toBe(selfAuth.username);
    expect(response.body.createdAt).toBeNull();
    expect(response.body.areFriends).toBe(false);
    expect(response.body.canViewStats).toBe(false);
    expect(response.body.stats).toBeNull();
  });

  it("Visible stats include recent games, streaks, win rate, and favorite game", async () => {
    await setStatsMode("public");
    const response = await viewProfileAs(selfAuth);

    expect(response.status).toBe(200);
    expect(response.body.stats).not.toBeNull();

    const stats = response.body.stats as {
      games: Array<{
        gameId: string;
        type: GameKey;
        playedAt: string;
        didWin: boolean;
        streak: number;
      }>;
      favoriteGame: GameKey | null;
      overallWinRate: number;
    };

    const returnedIds = stats.games.map((game) => game.gameId);
    expect(returnedIds).toEqual([
      fixtureNimNewest,
      fixtureGuessMiddle,
      fixtureNimMiddle,
      fixtureNimOldest,
    ]);

    const playedAtMs = stats.games.map((game) => new Date(game.playedAt).getTime());
    const sortedPlayedAtMs = [...playedAtMs].sort((a, b) => b - a);
    expect(playedAtMs).toStrictEqual(sortedPlayedAtMs);

    const expectedStreakByGame = expectedRunningStreaks(
      stats.games.map(({ gameId, didWin }) => ({ gameId, didWin })),
    );

    for (const game of stats.games) {
      expect(game.streak).toBe(expectedStreakByGame.get(game.gameId));
    }

    const wins = stats.games.filter((game) => game.didWin).length;
    const losses = stats.games.filter((game) => !game.didWin).length;
    const expectedWinRate = wins + losses === 0 ? 0 : wins / (wins + losses);
    expect(stats.overallWinRate).toBeCloseTo(expectedWinRate, 10);

    expect(stats.favoriteGame).toBe("nim");
  });
});
