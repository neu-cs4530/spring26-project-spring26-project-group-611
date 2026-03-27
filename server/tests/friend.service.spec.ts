import { describe, expect, it } from "vitest";
import {
  sendFriendRequest,
  acceptFriendRequest,
  removeFriend,
  getCurrentFriends,
} from "../src/services/friend.service.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

async function user1Id(username: string): Promise<string> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`${username} not found`);
  return user.userId;
}

describe("removeFriend", () => {
  it("should remove a friend successfully", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if (request && "error" in request) {
      throw new Error(request.error);
    }

    const user1 = await getUserByUsername("user1");
    if (!user1) throw new Error("user1 not found");

    const user2 = await getUserByUsername("user2");
    if (!user2) throw new Error("user2 not found");

    const accepted = await acceptFriendRequest(request.id, user2.userId);
    if (accepted && "error" in accepted) {
      throw new Error(accepted.error);
    }

    const result = await removeFriend(user1.userId, "user2");
    expect(result).toBeUndefined();
  });

  it("should remove friendship from both users", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if (request && "error" in request) {
      throw new Error(request.error);
    }

    const user2 = await getUserByUsername("user2");
    if (!user2) throw new Error("user2 not found");

    const accepted = await acceptFriendRequest(request.id, user2.userId);
    if (accepted && "error" in accepted) {
      throw new Error(accepted.error);
    }

    const user1 = await user1Id("user1");

    await removeFriend(user1, "user2");

    const user1Friends = await getCurrentFriends(user1);
    const user2Friends = await getCurrentFriends(user2.userId);

    if ("error" in user1Friends) {
      throw new Error(user1Friends.error);
    }
    if ("error" in user2Friends) {
      throw new Error(user2Friends.error);
    }

    expect(user1Friends.find((f) => f.username === "user2")).toBeUndefined();
    expect(user2Friends.find((f) => f.username === "user1")).toBeUndefined();
  });

  it("should fail if users are not friends", async () => {
    const user1 = await user1Id("user1");
    const result = await removeFriend(user1, "user3");
    expect(result).toHaveProperty("error");
  });

  it("should fail if target user does not exist", async () => {
    const user1 = await user1Id("user1");
    const result = await removeFriend(user1, "fakeUser");
    expect(result).toHaveProperty("error");
  });

  it("should fail if user tries to remove themselves", async () => {
    const user1 = await user1Id("user1");
    const result = await removeFriend(user1, "user1");
    expect(result).toHaveProperty("error");
  });
});
