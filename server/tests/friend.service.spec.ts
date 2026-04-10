import { describe, expect, it } from "vitest";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
  getCurrentFriends,
  getIncomingFriendRequests,
  getOutgoingFriendRequests,
} from "../src/services/friend.service.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

async function getUserId(username: string): Promise<string> {
  const user = await getUserByUsername(username);
  if (!user) throw new Error(`${username} not found`);
  return user.userId;
}

describe("sendFriendRequest", () => {
  it("should fail when sending a request to yourself", async () => {
    const result = await sendFriendRequest("user1", "user1");
    expect(result).toStrictEqual({ error: "You cannot send a friend request to yourself" });
  });

  it("should fail if target user does not exist", async () => {
    const result = await sendFriendRequest("user1", "fakeUser");
    expect(result).toStrictEqual({ error: "User not found" });
  });

  it("should succeed and return a pending FriendRequestInfo", async () => {
    const result = await sendFriendRequest("user1", "user2");
    if ("error" in result) throw new Error(result.error);

    expect(result.fromUsername).toBe("user1");
    expect(result.toUsername).toBe("user2");
    expect(result.status).toBe("pending");
    expect(result.id).toBeTruthy();
  });

  it("should fail if they are already friends", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user2Id = await getUserId("user2");
    await acceptFriendRequest(request.id, user2Id);

    const again = await sendFriendRequest("user1", "user2");
    expect(again).toStrictEqual({ error: "You are already friends with this user" });
  });

  it("should fail if a pending request already exists from sender to receiver", async () => {
    const first = await sendFriendRequest("user1", "user2");
    if ("error" in first) throw new Error(first.error);

    const second = await sendFriendRequest("user1", "user2");
    expect(second).toStrictEqual({
      error: "A pending friend request already exists between you and this user",
    });
  });

  it("should fail if a pending request already exists from receiver to sender", async () => {
    const first = await sendFriendRequest("user2", "user1");
    if ("error" in first) throw new Error(first.error);

    const second = await sendFriendRequest("user1", "user2");
    expect(second).toStrictEqual({
      error: "A pending friend request already exists between you and this user",
    });
  });
});

describe("acceptFriendRequest", () => {
  it("should fail if the request does not exist", async () => {
    const user2Id = await getUserId("user2");
    const result = await acceptFriendRequest("fake-request-id", user2Id);
    expect(result).toStrictEqual({ error: "Friend request not found" });
  });

  it("should fail if the accepting user is not the recipient", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user3Id = await getUserId("user3");
    const result = await acceptFriendRequest(request.id, user3Id);
    expect(result).toStrictEqual({ error: "You cannot accept this request" });
  });

  it("should fail if the request is no longer pending", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user2Id = await getUserId("user2");
    await acceptFriendRequest(request.id, user2Id);

    const again = await acceptFriendRequest(request.id, user2Id);
    expect(again).toStrictEqual({ error: "Friend request already processed" });
  });

  it("should add each user to the other's friends list on success", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user1Id = await getUserId("user1");
    const user2Id = await getUserId("user2");

    const result = await acceptFriendRequest(request.id, user2Id);
    expect(result).toBeUndefined();

    const user1Friends = await getCurrentFriends(user1Id);
    const user2Friends = await getCurrentFriends(user2Id);

    if ("error" in user1Friends) throw new Error(user1Friends.error);
    if ("error" in user2Friends) throw new Error(user2Friends.error);

    expect(user1Friends.some((f) => f.username === "user2")).toBe(true);
    expect(user2Friends.some((f) => f.username === "user1")).toBe(true);
  });
});

describe("declineFriendRequest", () => {
  it("should fail if the request does not exist", async () => {
    const user2Id = await getUserId("user2");
    const result = await declineFriendRequest("fake-request-id", user2Id);
    expect(result).toStrictEqual({ error: "Friend request not found" });
  });

  it("should fail if the declining user is not the recipient", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user3Id = await getUserId("user3");
    const result = await declineFriendRequest(request.id, user3Id);
    expect(result).toStrictEqual({ error: "You cannot decline this request" });
  });

  it("should fail if the request is no longer pending", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user2Id = await getUserId("user2");
    await declineFriendRequest(request.id, user2Id);

    const again = await declineFriendRequest(request.id, user2Id);
    expect(again).toStrictEqual({ error: "Friend request already processed" });
  });

  it("should decline successfully and return undefined", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user2Id = await getUserId("user2");
    const result = await declineFriendRequest(request.id, user2Id);
    expect(result).toBeUndefined();
  });

  it("should not add users as friends after declining", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user1Id = await getUserId("user1");
    const user2Id = await getUserId("user2");

    await declineFriendRequest(request.id, user2Id);

    const user1Friends = await getCurrentFriends(user1Id);
    if ("error" in user1Friends) throw new Error(user1Friends.error);
    expect(user1Friends.some((f) => f.username === "user2")).toBe(false);
  });
});

describe("cancelFriendRequest", () => {
  it("should fail if the request does not exist", async () => {
    const user1Id = await getUserId("user1");
    const result = await cancelFriendRequest("fake-request-id", user1Id);
    expect(result).toStrictEqual({ error: "Friend request not found" });
  });

  it("should fail if the cancelling user is not the sender", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user2Id = await getUserId("user2");
    const result = await cancelFriendRequest(request.id, user2Id);
    expect(result).toStrictEqual({ error: "You cannot cancel this request" });
  });

  it("should fail if the request is no longer pending", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user1Id = await getUserId("user1");
    const user2Id = await getUserId("user2");
    await acceptFriendRequest(request.id, user2Id);

    const result = await cancelFriendRequest(request.id, user1Id);
    expect(result).toStrictEqual({ error: "Request already processed" });
  });

  it("should cancel successfully and allow a new request to be sent", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user1Id = await getUserId("user1");
    const result = await cancelFriendRequest(request.id, user1Id);
    expect(result).toBeUndefined();

    const newRequest = await sendFriendRequest("user1", "user2");
    expect("error" in newRequest).toBe(false);
  });
});

describe("getIncomingFriendRequests", () => {
  it("should return an empty list when there are no incoming requests", async () => {
    const result = await getIncomingFriendRequests("user1");
    expect(result).toStrictEqual([]);
  });

  it("should return only pending requests sent to the user", async () => {
    const request = await sendFriendRequest("user2", "user1");
    if ("error" in request) throw new Error(request.error);

    const result = await getIncomingFriendRequests("user1");
    expect(result.length).toBe(1);
    expect(result[0].fromUsername).toBe("user2");
    expect(result[0].toUsername).toBe("user1");
    expect(result[0].status).toBe("pending");
  });

  it("should not return outgoing requests sent by the user", async () => {
    await sendFriendRequest("user1", "user2");

    const result = await getIncomingFriendRequests("user1");
    expect(result.length).toBe(0);
  });

  it("should not return already-accepted requests", async () => {
    const request = await sendFriendRequest("user2", "user1");
    if ("error" in request) throw new Error(request.error);

    const user1Id = await getUserId("user1");
    await acceptFriendRequest(request.id, user1Id);

    const result = await getIncomingFriendRequests("user1");
    expect(result.length).toBe(0);
  });

  it("should return an empty list for a nonexistent user", async () => {
    const result = await getIncomingFriendRequests("fakeUser");
    expect(result).toStrictEqual([]);
  });
});

describe("getOutgoingFriendRequests", () => {
  it("should return an empty list when there are no outgoing requests", async () => {
    const result = await getOutgoingFriendRequests("user1");
    expect(result).toStrictEqual([]);
  });

  it("should return only pending requests sent by the user", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const result = await getOutgoingFriendRequests("user1");
    expect(result.length).toBe(1);
    expect(result[0].fromUsername).toBe("user1");
    expect(result[0].toUsername).toBe("user2");
    expect(result[0].status).toBe("pending");
  });

  it("should not return requests sent to the user", async () => {
    await sendFriendRequest("user2", "user1");

    const result = await getOutgoingFriendRequests("user1");
    expect(result.length).toBe(0);
  });

  it("should not return already-declined requests", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user2Id = await getUserId("user2");
    await declineFriendRequest(request.id, user2Id);

    const result = await getOutgoingFriendRequests("user1");
    expect(result.length).toBe(0);
  });

  it("should return an empty list for a nonexistent user", async () => {
    const result = await getOutgoingFriendRequests("fakeUser");
    expect(result).toStrictEqual([]);
  });
});

describe("getCurrentFriends", () => {
  it("should return an error if user does not exist", async () => {
    const result = await getCurrentFriends("fake-user-id");
    expect(result).toStrictEqual({ error: "User not found" });
  });

  it("should return an empty list when user has no friends", async () => {
    const user1Id = await getUserId("user1");
    const result = await getCurrentFriends(user1Id);
    if ("error" in result) throw new Error(result.error);
    expect(result).toStrictEqual([]);
  });

  it("should return the friends list after accepting a request", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user1Id = await getUserId("user1");
    const user2Id = await getUserId("user2");
    await acceptFriendRequest(request.id, user2Id);

    const result = await getCurrentFriends(user1Id);
    if ("error" in result) throw new Error(result.error);

    expect(result.length).toBe(1);
    expect(result[0].username).toBe("user2");
  });
});

describe("removeFriend", () => {
  it("should remove a friend successfully", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user2 = await getUserByUsername("user2");
    if (!user2) throw new Error("user2 not found");

    await acceptFriendRequest(request.id, user2.userId);

    const user1Id = await getUserId("user1");
    const result = await removeFriend(user1Id, "user2");
    expect(result).toBeUndefined();
  });

  it("should remove friendship from both users", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user2 = await getUserByUsername("user2");
    if (!user2) throw new Error("user2 not found");

    await acceptFriendRequest(request.id, user2.userId);

    const user1Id = await getUserId("user1");
    await removeFriend(user1Id, "user2");

    const user1Friends = await getCurrentFriends(user1Id);
    const user2Friends = await getCurrentFriends(user2.userId);

    if ("error" in user1Friends) throw new Error(user1Friends.error);
    if ("error" in user2Friends) throw new Error(user2Friends.error);

    expect(user1Friends.find((f) => f.username === "user2")).toBeUndefined();
    expect(user2Friends.find((f) => f.username === "user1")).toBeUndefined();
  });

  it("should allow the pair to become friends again after removal", async () => {
    const request = await sendFriendRequest("user1", "user2");
    if ("error" in request) throw new Error(request.error);

    const user1Id = await getUserId("user1");
    const user2Id = await getUserId("user2");
    await acceptFriendRequest(request.id, user2Id);
    await removeFriend(user1Id, "user2");

    const newRequest = await sendFriendRequest("user1", "user2");
    expect("error" in newRequest).toBe(false);
  });

  it("should fail if users are not friends", async () => {
    const user1Id = await getUserId("user1");
    const result = await removeFriend(user1Id, "user3");
    expect(result).toHaveProperty("error");
  });

  it("should fail if target user does not exist", async () => {
    const user1Id = await getUserId("user1");
    const result = await removeFriend(user1Id, "fakeUser");
    expect(result).toHaveProperty("error");
  });

  it("should fail if user tries to remove themselves", async () => {
    const user1Id = await getUserId("user1");
    const result = await removeFriend(user1Id, "user1");
    expect(result).toHaveProperty("error");
  });
});
