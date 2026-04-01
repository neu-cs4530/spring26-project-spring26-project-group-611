import { describe, expect, it } from "vitest";
import supertest from "supertest";
import { app } from "../src/app.ts";
import { GameRepo, UserRepo } from "../src/repository.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";
import {
  sendGameInvite,
  getInvitesForUser,
  getInvitesSentByUser,
  toggleAcceptGameInvites,
  acceptInvite,
  declineInvite,
  acceptPendingInvitesForGame,
} from "../src/services/game.invite.service.ts";
import { joinGame } from "../src/services/game.service.ts";

const hostAuth = { username: "user3", password: "pwd3333" };

async function getUserId(username: string): Promise<string> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`${username} not found`);
  return user.userId;
}

async function makeFriends(username1: string, username2: string): Promise<void> {
  const user1 = await getUserByUsername(username1);
  const user2 = await getUserByUsername(username2);

  if (!user1) throw new Error(`${username1} not found`);
  if (!user2) throw new Error(`${username2} not found`);

  const user1Record = await UserRepo.get(user1.userId);
  const user2Record = await UserRepo.get(user2.userId);

  if (!user1Record.friends.includes(user2.userId)) {
    user1Record.friends.push(user2.userId);
    await UserRepo.set(user1.userId, user1Record);
  }

  if (!user2Record.friends.includes(user1.userId)) {
    user2Record.friends.push(user1.userId);
    await UserRepo.set(user2.userId, user2Record);
  }
}

async function createGame(visibility: "public" | "private"): Promise<string> {
  const response = await supertest(app)
    .post("/api/game/create")
    .send({
      auth: hostAuth,
      payload: { type: "nim", visibility },
    });

  expect(response.status).toBe(200);

  const body: unknown = response.body;
  if (
    typeof body !== "object" ||
    body === null ||
    !("gameId" in body) ||
    typeof body.gameId !== "string"
  ) {
    throw new Error("Invalid gameId");
  }

  return body.gameId;
}

describe("sendGameInvite", () => {
  it("should fail if target user is not a friend", async () => {
    const hostUserId = await getUserId("user3");
    const gameId = await createGame("private");

    const result = await sendGameInvite(hostUserId, "user2", gameId);

    expect(result).toStrictEqual({
      error: "You can only invite friends to a private game",
    });
  });

  it("should send a pending invite to a friend for a private game", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const gameId = await createGame("private");

    const result = await sendGameInvite(hostUserId, "user2", gameId);

    if ("error" in result) {
      throw new Error(result.error);
    }

    expect(result.gameId).toBe(gameId);
    expect(result.fromUsername).toBe("user3");
    expect(result.toUsername).toBe("user2");
    expect(result.status).toBe("pending");
  });

  it("should reject a duplicate pending invite", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const gameId = await createGame("private");

    const first = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in first) {
      throw new Error(first.error);
    }

    const second = await sendGameInvite(hostUserId, "user2", gameId);

    expect(second).toStrictEqual({
      error: "An invite has already been sent to this player for this game",
    });
  });

  it("should fail if the game is public", async () => {
    await makeFriends("user3", "user2");
    const hostUserId = await getUserId("user3");
    const gameId = await createGame("public");

    const result = await sendGameInvite(hostUserId, "user2", gameId);

    expect(result).toStrictEqual({
      error: "Cannot send invites for a public game",
    });
  });

  it("should fail if the host is not the game creator", async () => {
    await makeFriends("user3", "user2");
    const wrongHostUserId = await getUserId("user1");
    const gameId = await createGame("private");

    const result = await sendGameInvite(wrongHostUserId, "user2", gameId);

    expect(result).toStrictEqual({
      error: "Only the host can send invites for this game",
    });
  });

  it("should fail if the target player does not exist", async () => {
    const hostUserId = await getUserId("user3");
    const gameId = await createGame("private");

    const result = await sendGameInvite(hostUserId, "fakeUser", gameId);

    expect(result).toStrictEqual({
      error: "Player not found",
    });
  });

  it("should fail if the host invites themselves", async () => {
    await makeFriends("user3", "user2");
    const hostUserId = await getUserId("user3");
    const gameId = await createGame("private");

    const result = await sendGameInvite(hostUserId, "user3", gameId);

    expect(result).toStrictEqual({
      error: "Cannot invite yourself to your own game",
    });
  });

  it("should fail if the game has already started", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const gameId = await createGame("private");

    const game = await GameRepo.get(gameId);
    game.state = {} as never;
    await GameRepo.set(gameId, game);

    const result = await sendGameInvite(hostUserId, "user2", gameId);

    expect(result).toStrictEqual({
      error: "Cannot invite players to a game that has already started",
    });
  });

  it("should fail if the target user is already in the game", async () => {
    await makeFriends("user3", "user2");
    const hostUserId = await getUserId("user3");
    const friend = await getUserByUsername("user2");
    if (!friend) throw new Error("user2 not found");

    const gameId = await createGame("private");
    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    const accepted = await acceptInvite(friend.userId, invite.inviteId);
    if ("error" in accepted) {
      throw new Error(accepted.error);
    }

    const result = await sendGameInvite(hostUserId, "user2", gameId);

    expect(result).toStrictEqual({
      error: "Player is already in the game",
    });
  });

  it("should fail if target user is not accepting invites", async () => {
    await makeFriends("user3", "user2");
    const hostUserId = await getUserId("user3");
    const user2Id = await getUserId("user2");
    const gameId = await createGame("private");

    const toggled = await toggleAcceptGameInvites(user2Id);
    if ("error" in toggled) {
      throw new Error(toggled.error);
    }

    const result = await sendGameInvite(hostUserId, "user2", gameId);

    expect(result).toStrictEqual({
      error: "user2 is not accepting game invites",
    });

    const toggledBack = await toggleAcceptGameInvites(user2Id);
    if ("error" in toggledBack) {
      throw new Error(toggledBack.error);
    }
  });

  it("should fail if the game does not exist", async () => {
    const hostUserId = await getUserId("user3");

    const result = await sendGameInvite(hostUserId, "user2", "fake-game-id");

    expect(result).toStrictEqual({
      error: "Game not found",
    });
  });
});

describe("getInvitesForUser", () => {
  it("should return pending invites for the invited user", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const user2Id = await getUserId("user2");
    const gameId = await createGame("private");

    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    const invites = await getInvitesForUser(user2Id);

    expect(invites.some((item) => item.inviteId === invite.inviteId)).toBe(true);
  });
});

describe("getInvitesSentByUser", () => {
  it("should return pending invites sent by the host", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const gameId = await createGame("private");

    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    const invites = await getInvitesSentByUser(hostUserId);

    expect(invites.some((item) => item.inviteId === invite.inviteId)).toBe(true);
  });
});

describe("toggleAcceptGameInvites", () => {
  it("should toggle the acceptGameInvites setting", async () => {
    const user2Id = await getUserId("user2");

    const first = await toggleAcceptGameInvites(user2Id);
    if ("error" in first) {
      throw new Error(first.error);
    }

    const second = await toggleAcceptGameInvites(user2Id);
    if ("error" in second) {
      throw new Error(second.error);
    }

    expect(second.acceptGameInvites).toBe(!first.acceptGameInvites);
  });

  it("should fail if the user does not exist", async () => {
    const result = await toggleAcceptGameInvites("fake-user-id");

    expect(result).toStrictEqual({
      error: "User not found",
    });
  });
});

describe("acceptInvite", () => {
  it("should accept an invite and join the invited user to the game", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const user2Id = await getUserId("user2");
    const gameId = await createGame("private");

    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    const accepted = await acceptInvite(user2Id, invite.inviteId);
    if ("error" in accepted) {
      throw new Error(accepted.error);
    }

    expect(accepted.status).toBe("accepted");

    await expect(
      joinGame(gameId, {
        userId: user2Id,
        username: "user2",
      }),
    ).rejects.toThrow("already");
  });

  it("should reject accepting an invite for a different user", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const user1Id = await getUserId("user1");
    const gameId = await createGame("private");

    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    const result = await acceptInvite(user1Id, invite.inviteId);

    expect(result).toStrictEqual({
      error: "You cannot accept this invite",
    });
  });

  it("should fail if invite does not exist", async () => {
    const user2Id = await getUserId("user2");

    const result = await acceptInvite(user2Id, "fake-invite-id");

    expect(result).toStrictEqual({
      error: "Invite not found",
    });
  });

  it("should fail if invite is no longer pending", async () => {
    await makeFriends("user3", "user2");
    const hostUserId = await getUserId("user3");
    const user2Id = await getUserId("user2");
    const gameId = await createGame("private");

    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    const accepted = await acceptInvite(user2Id, invite.inviteId);
    if ("error" in accepted) {
      throw new Error(accepted.error);
    }

    const result = await acceptInvite(user2Id, invite.inviteId);

    expect(result).toStrictEqual({
      error: "This invite is no longer pending",
    });
  });
});

describe("declineInvite", () => {
  it("should decline a pending invite", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const user2Id = await getUserId("user2");
    const gameId = await createGame("private");

    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    const declined = await declineInvite(user2Id, invite.inviteId);
    if ("error" in declined) {
      throw new Error(declined.error);
    }

    expect(declined.status).toBe("declined");
  });

  it("should fail if invite does not exist", async () => {
    const user2Id = await getUserId("user2");

    const result = await declineInvite(user2Id, "fake-invite-id");

    expect(result).toStrictEqual({
      error: "Invite not found",
    });
  });

  it("should fail if wrong user tries to decline invite", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const user1Id = await getUserId("user1");
    const gameId = await createGame("private");

    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    const result = await declineInvite(user1Id, invite.inviteId);

    expect(result).toStrictEqual({
      error: "You cannot decline this invite",
    });
  });

  it("should fail if invite is no longer pending", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const user2Id = await getUserId("user2");
    const gameId = await createGame("private");

    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    const declined = await declineInvite(user2Id, invite.inviteId);
    if ("error" in declined) {
      throw new Error(declined.error);
    }

    const result = await declineInvite(user2Id, invite.inviteId);

    expect(result).toStrictEqual({
      error: "This invite is no longer pending",
    });
  });
});

describe("acceptPendingInvitesForGame", () => {
  it("should mark pending invites for a user and game as accepted", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const user2Id = await getUserId("user2");
    const gameId = await createGame("private");

    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    await acceptPendingInvitesForGame(user2Id, gameId);

    const pendingInvites = await getInvitesForUser(user2Id);

    expect(pendingInvites.some((item) => item.inviteId === invite.inviteId)).toBe(false);
  });

  it("should do nothing when there are no matching pending invites", async () => {
    await makeFriends("user3", "user2");

    const hostUserId = await getUserId("user3");
    const user2Id = await getUserId("user2");
    const gameId = await createGame("private");

    const invite = await sendGameInvite(hostUserId, "user2", gameId);
    if ("error" in invite) {
      throw new Error(invite.error);
    }

    await acceptPendingInvitesForGame(user2Id, "some-other-game-id");

    const pendingInvites = await getInvitesForUser(user2Id);

    expect(pendingInvites.some((item) => item.inviteId === invite.inviteId)).toBe(true);
  });
});
