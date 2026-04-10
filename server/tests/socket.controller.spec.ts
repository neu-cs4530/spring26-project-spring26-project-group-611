import { describe, expect, it, vi, afterEach } from "vitest";
import type { GameServerSocket } from "../src/types.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";

const mockSocket = { id: "socket-1" } as unknown as GameServerSocket;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logSocketError", () => {
  it("logs standard Error instances", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logSocketError(mockSocket, new Error("boom"));

    expect(logSpy).toHaveBeenCalledExactlyOnceWith('ERR! [socket-1] error message: "boom"');
  });

  it("logs unexpected non-Error values", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logSocketError(mockSocket, { code: "E1", reason: "weird" });

    expect(logSpy).toHaveBeenCalledExactlyOnceWith(
      'ERR! [socket-1] unexpected error {"code":"E1","reason":"weird"}',
    );
  });
});
