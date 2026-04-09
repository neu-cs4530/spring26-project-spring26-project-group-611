import { act, renderHook } from "@testing-library/react";
import type { GamePlayInfo, SafeUserInfo, TaggedGameView } from "@gamenite/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import useSocketsForGame from "../../src/hooks/useSocketsForGame.ts";
import useLoginContext from "../../src/hooks/useLoginContext.ts";

vi.mock("../../src/hooks/useLoginContext.ts", () => ({
  default: vi.fn(),
}));

type Handler = (payload: unknown) => void;

function createMockSocket() {
  const handlers = new Map<string, Set<Handler>>();

  const socket = {
    on: vi.fn((event: string, handler: Handler) => {
      const eventHandlers = handlers.get(event) ?? new Set<Handler>();
      eventHandlers.add(handler);
      handlers.set(event, eventHandlers);
      return socket;
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
      return socket;
    }),
    emit: vi.fn(),
  };

  const trigger = (event: string, payload: unknown) => {
    handlers.get(event)?.forEach((handler) => handler(payload));
  };

  return { socket, trigger };
}

function makeUser(username: string): SafeUserInfo {
  return {
    username,
    display: username.toUpperCase(),
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    acceptGameInvites: true,
  };
}

function makeView(label: string): TaggedGameView {
  return {
    type: "nim",
    view: { label } as never,
  };
}

describe("useSocketsForGame", () => {
  const currentUser = makeUser("user1");
  const otherUser = makeUser("user2");
  const authContext = {
    user: currentUser,
    pass: "secret",
    reset: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(useLoginContext).mockReturnValue({
      ...authContext,
      socket: createMockSocket().socket as never,
    });
  });

  it("watches the game on mount, supports joining and starting, and clears join errors", () => {
    const { socket, trigger } = createMockSocket();
    vi.mocked(useLoginContext).mockReturnValue({
      ...authContext,
      socket: socket as never,
    });

    const { result } = renderHook(() => useSocketsForGame("game-1", [currentUser, otherUser]));

    expect(socket.emit).toHaveBeenCalledWith("gameWatch", {
      auth: { username: "user1", password: "secret" },
      payload: "game-1",
    });

    act(() => {
      trigger("gameJoinError", "cannot join yet");
    });

    expect(result.current.joinError).toBe("cannot join yet");

    act(() => {
      result.current.joinGame();
    });

    expect(result.current.joinError).toBeNull();
    expect(socket.emit).toHaveBeenCalledWith("gameJoinAsPlayer", {
      auth: { username: "user1", password: "secret" },
      payload: "game-1",
    });

    act(() => {
      result.current.startGame();
    });

    expect(socket.emit).toHaveBeenCalledWith("gameStart", {
      auth: { username: "user1", password: "secret" },
      payload: "game-1",
    });
  });

  it("ignores updates for other games and only accepts state updates relevant to the current player", () => {
    const { socket, trigger } = createMockSocket();
    vi.mocked(useLoginContext).mockReturnValue({
      ...authContext,
      socket: socket as never,
    });

    const initialView = makeView("initial");
    const nextPlayerView = makeView("player-update");
    const nextSpectatorView = makeView("spectator-update");
    const playerUpdate = { ...nextPlayerView, forPlayer: true };
    const spectatorUpdate = { ...nextSpectatorView, forPlayer: false };

    const { result } = renderHook(() => useSocketsForGame("game-1", [currentUser]));

    act(() => {
      trigger("gameWatched", {
        gameId: "different-game",
        view: initialView,
        players: [otherUser],
      } as GamePlayInfo);
    });

    expect(result.current.hasWatched).toBe(false);
    expect(result.current.view).toBeNull();

    act(() => {
      trigger("gameWatched", {
        gameId: "game-1",
        view: initialView,
        players: [currentUser, otherUser],
      } as GamePlayInfo);
    });

    expect(result.current.hasWatched).toBe(true);
    expect(result.current.players).toEqual([currentUser, otherUser]);
    expect(result.current.view).toBe(initialView);

    act(() => {
      trigger("gameStateUpdated", spectatorUpdate);
    });

    expect(result.current.view).toBe(initialView);

    act(() => {
      trigger("gameStateUpdated", playerUpdate);
    });

    expect(result.current.view).toEqual(playerUpdate);
  });

  it("removes all listeners on cleanup", () => {
    const { socket } = createMockSocket();
    vi.mocked(useLoginContext).mockReturnValue({
      ...authContext,
      socket: socket as never,
    });

    const { unmount } = renderHook(() => useSocketsForGame("game-1", [currentUser]));

    const onCalls = socket.on.mock.calls;
    const watchedHandler = onCalls.find(([event]) => event === "gameWatched")?.[1] as Handler;
    const playersHandler = onCalls.find(([event]) => event === "gamePlayersUpdated")?.[1] as Handler;
    const stateHandler = onCalls.find(([event]) => event === "gameStateUpdated")?.[1] as Handler;
    const joinErrorHandler = onCalls.find(([event]) => event === "gameJoinError")?.[1] as Handler;

    unmount();

    expect(socket.off).toHaveBeenCalledWith("gameWatched", watchedHandler);
    expect(socket.off).toHaveBeenCalledWith("gamePlayersUpdated", playersHandler);
    expect(socket.off).toHaveBeenCalledWith("gameStateUpdated", stateHandler);
    expect(socket.off).toHaveBeenCalledWith("gameJoinError", joinErrorHandler);
  });
});