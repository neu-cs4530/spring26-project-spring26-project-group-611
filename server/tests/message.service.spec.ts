import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMessage, getMessagesById } from "../src/services/message.service.ts";
import { MessageRepo } from "../src/repository.ts";
import * as userService from "../src/services/user.service.ts";
import { getUserByUsername } from "../src/services/auth.service.ts";

describe("message.service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should store a new message and return populated message info", async () => {
    const createdAt = new Date("2026-04-01T10:30:00.000Z");

    const user = await getUserByUsername("user1");
    if (!user) throw new Error("user1 not found");

    vi.spyOn(MessageRepo, "add").mockResolvedValue("msg-1");
    vi.spyOn(MessageRepo, "get").mockResolvedValue({
      text: "hello world",
      createdAt: createdAt.toISOString(),
      createdBy: user.userId,
    });

    vi.spyOn(userService, "populateSafeUserInfo").mockResolvedValue({
      username: "user1",
      display: "User One",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await createMessage(user, "hello world", createdAt);

    expect(MessageRepo.add).toHaveBeenCalledExactlyOnceWith({
      text: "hello world",
      createdAt: createdAt.toISOString(),
      createdBy: user.userId,
    });

    expect(MessageRepo.get).toHaveBeenCalledExactlyOnceWith("msg-1");
    expect(userService.populateSafeUserInfo).toHaveBeenCalledExactlyOnceWith(user.userId);

    expect(result).toStrictEqual({
      messageId: "msg-1",
      text: "hello world",
      createdAt,
      createdBy: {
        username: "user1",
        display: "User One",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
  });

  it("should return an empty array when given no ids", async () => {
    const result = await getMessagesById([]);

    expect(result).toStrictEqual([]);
    expect(MessageRepo.get).not.toHaveBeenCalled();
    expect(userService.populateSafeUserInfo).not.toHaveBeenCalled();
  });
});
