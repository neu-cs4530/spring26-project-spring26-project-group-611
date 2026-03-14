import { describe, expect, it } from "vitest";
import {
  updateUser,
  canViewerSeeStats,
  getProfileViewByUsername,
} from "../../src/services/user.service.ts";
import { enforceAuth, getUserByUsername } from "../../src/services/auth.service.ts";
import { acceptFriendRequest, sendFriendRequest } from "../../src/services/friend.service.ts";

// enforceAuth isn't tested by current integration tests,
// because existing tests exercise the REST api, and enforceAuth
// is only used in the socket api
describe("enforceAuth", () => {
  it("should return a user and id on good auth", async () => {
    const user = await enforceAuth({ username: "user1", password: "pwd1111" });
    expect(user).toStrictEqual({ userId: expect.any(String), username: "user1" });
  });

  it("should raise on bad auth", async () => {
    await expect(enforceAuth({ username: "user1", password: "no" })).rejects.toThrow();
  });
});

// updateUser can't be fully tested by current integration tests; part of its
// contract is that it throws if updateUser is called with an invalid user id,
// but a well-behaved controller won't ever invoke updateUser with an invalid
// user id
describe("updateUser", () => {
  it("should throw if given an invalid user id", async () => {
    await expect(updateUser("fake", { display: "Stacey Fakename" })).rejects.toThrow();
  });

  it("should update stats visibility setting", async () => {
    await updateUser("user1", { canViewStats: false });
    const viewdByNonFriend = await getProfileViewByUsername("user1", "user2");
    expect(viewdByNonFriend?.canViewStats).toBe(false);

    await updateUser("user1", { canViewStats: true });
    const viewdAgainByNonFriend = await getProfileViewByUsername("user1", "user2");
    expect(viewdAgainByNonFriend?.canViewStats).toBe(true);
  });
});

describe("canViewerSeeStats", () => {
  it("should always allow self see view", () => {
    expect(canViewerSeeStats(true, false, false)).toBe(true);
  });
  it("should always allow friend even when target is not public", () => {
    expect(canViewerSeeStats(false, true, false)).toBe(true);
  });
  it("should respect target public visibility for non-friends", () => {
    expect(canViewerSeeStats(false, false, true)).toBe(true);
    expect(canViewerSeeStats(false, false, false)).toBe(false);
  });
});

describe("getProfileViewByUsername visibility behavior", () => {
  it("should always allow ownerto view their own stats", async () => {
    await updateUser("user1", { canViewStats: false });
    const selfView = await getProfileViewByUsername("user1", "user1");
    expect(selfView).not.toBeNull();
    expect(selfView?.canViewStats).toBe(true);
  });
  it("should allow friend even when target is non-public", async () => {
    await updateUser("user1", { canViewStats: false });
    const request = await sendFriendRequest("user2", "user1");
    if (request && "error" in request) {
      throw new Error(request.error);
    }
    const user1 = await getUserByUsername("user1");
    if (!user1) {
      throw new Error("user1 not found");
    }
    const accepted = await acceptFriendRequest(request.id, user1.userId);
    if (accepted && "error" in accepted) {
      throw new Error(accepted.error);
    }
    const friendView = await getProfileViewByUsername("user1", "user2");
    expect(friendView).not.toBeNull();
    expect(friendView?.areFriends).toBe(true);
    expect(friendView?.canViewStats).toBe(true);
  });
});
