import { describe, expect, it } from "vitest";
import {
  createGame,
  joinGame,
  startGame,
  updateGame,
  viewGame,
} from "../../src/services/game.service.ts";
import { getUserByUsername } from "../../src/services/auth.service.ts";

type ExistingUser = { userId: string; username: string };

async function requireUser(username: string): Promise<ExistingUser> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`${username} not found`);
  return user;
}

describe("game.service high-value branches", () => {
  it("joinGame rejects joining a full game", async () => {
    const host = await requireUser("user3");
    const user2 = await requireUser("user2");
    const user1 = await requireUser("user1");

    const game = await createGame(host, "nim", new Date(), "public");
    await joinGame(game.gameId, user2);

    await expect(joinGame(game.gameId, user1)).rejects.toThrow("joining full");
  });

  it("startGame rejects underpopulated game", async () => {
    const host = await requireUser("user3");
    const game = await createGame(host, "nim", new Date(), "public");

    await expect(startGame(game.gameId, host)).rejects.toThrow("underpopulated game");
  });

  it("startGame rejects users who are not in the game", async () => {
    const host = await requireUser("user3");
    const user2 = await requireUser("user2");
    const outsider = await requireUser("user1");

    const game = await createGame(host, "nim", new Date(), "public");
    await joinGame(game.gameId, user2);

    await expect(startGame(game.gameId, outsider)).rejects.toThrow("starting game they're not in");
  });

  it("updateGame rejects moves before game has started", async () => {
    const host = await requireUser("user3");
    const game = await createGame(host, "guess", new Date(), "public");

    await expect(updateGame(game.gameId, host, 20)).rejects.toThrow("hadn't started");
  });

  it("updateGame rejects moves from non-players", async () => {
    const host = await requireUser("user3");
    const user2 = await requireUser("user2");
    const outsider = await requireUser("user1");

    const game = await createGame(host, "guess", new Date(), "public");
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, host);

    await expect(updateGame(game.gameId, outsider, 50)).rejects.toThrow("weren't playing");
  });

  it("updateGame marks game done and returns chat id after final guess", async () => {
    const host = await requireUser("user3");
    const user2 = await requireUser("user2");

    const game = await createGame(host, "guess", new Date(), "public");
    await joinGame(game.gameId, user2);
    await startGame(game.gameId, host);

    await updateGame(game.gameId, host, 10);
    const result = await updateGame(game.gameId, user2, 20);

    expect(result.chatId).toBe(game.chat);
    expect(result.moveDescription).toContain("secret was");
    expect(result.views.watchers.type).toBe("guess");
  });

  it("viewGame returns waiting-room info for non-player before start", async () => {
    const host = await requireUser("user3");
    const outsider = await requireUser("user1");

    const game = await createGame(host, "nim", new Date(), "public");
    const view = await viewGame(game.gameId, outsider);

    expect(view.isPlayer).toBe(false);
    expect(view.view).toBeNull();
    expect(view.players.some((player) => player.username === "user3")).toBe(true);
  });

  it("viewGame rejects invalid game id", async () => {
    const host = await requireUser("user3");
    await expect(viewGame("missing-game-id", host)).rejects.toThrow("viewed an invalid game id");
  });
});
