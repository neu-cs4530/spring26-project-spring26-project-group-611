import { describe, expect, it, vi } from "vitest";
import { GameService } from "../../src/games/gameServiceManager.ts";
import type { GameLogic } from "../../src/games/gameLogic.ts";
import type { TaggedGameView } from "@gamenite/shared";

type State = { turn: number; done: boolean };
type View = { viewer: number; turn: number };

function makeLogic(overrides?: Partial<GameLogic<State, View>>): GameLogic<State, View> {
  return {
    minPlayers: 2,
    maxPlayers: 4,
    start: (numPlayers) => ({ turn: numPlayers, done: false }),
    update: (state, _payload, _playerIndex) => ({ ...state, turn: state.turn + 1 }),
    isDone: (state) => state.done,
    viewAs: (state, playerIndex) => ({ viewer: playerIndex, turn: state.turn }),
    tagView: (view) => ({ type: "nim", view }) as unknown as TaggedGameView,
    describeMove: () => " made a move",
    getWinnerIndexes: () => [0],
    ...overrides,
  };
}

describe("GameService", () => {
  it("exposes minPlayers and maxPlayers from logic", () => {
    const service = new GameService(makeLogic({ minPlayers: 3, maxPlayers: null }));

    expect(service.minPlayers).toBe(3);
    expect(service.maxPlayers).toBeNull();
  });

  it("create initializes state and player/watcher views", () => {
    const service = new GameService(makeLogic());
    const players = ["u1", "u2", "u3"];

    const created = service.create(players);

    expect(created.state).toStrictEqual({ turn: 3, done: false });
    expect(created.views.watchers).toStrictEqual({
      type: "nim",
      view: { viewer: -1, turn: 3 },
    });
    expect(created.views.players).toStrictEqual([
      { userId: "u1", view: { type: "nim", view: { viewer: 0, turn: 3 } } },
      { userId: "u2", view: { type: "nim", view: { viewer: 1, turn: 3 } } },
      { userId: "u3", view: { type: "nim", view: { viewer: 2, turn: 3 } } },
    ]);
  });

  it("view throws when state does not exist", () => {
    const service = new GameService(makeLogic());

    expect(() => service.view(null, 0)).toThrow("Game state does not exist");
  });

  it("view returns tagged game view", () => {
    const service = new GameService(makeLogic());

    const view = service.view({ turn: 10, done: false }, 1);

    expect(view).toStrictEqual({ type: "nim", view: { viewer: 1, turn: 10 } });
  });

  it("update returns null for invalid move", () => {
    const service = new GameService(makeLogic({ update: () => null }));

    const result = service.update({ turn: 1, done: false }, { move: "bad" }, 0, ["u1", "u2"]);

    expect(result).toBeNull();
  });

  it("update returns new state, views, move description and no winners when not done", () => {
    const service = new GameService(
      makeLogic({
        update: (state) => ({ ...state, turn: state.turn + 1, done: false }),
        isDone: () => false,
        describeMove: () => " advanced turn",
      }),
    );

    const result = service.update({ turn: 1, done: false }, { move: 1 }, 0, ["u1", "u2"]);

    expect(result).toStrictEqual({
      state: { turn: 2, done: false },
      views: {
        watchers: { type: "nim", view: { viewer: -1, turn: 2 } },
        players: [
          { userId: "u1", view: { type: "nim", view: { viewer: 0, turn: 2 } } },
          { userId: "u2", view: { type: "nim", view: { viewer: 1, turn: 2 } } },
        ],
      },
      done: false,
      moveDescription: " advanced turn",
      winnerIndexes: [],
    });
  });

  it("update includes winner indexes when game is done", () => {
    const winnerSpy = vi.fn(() => [1]);
    const service = new GameService(
      makeLogic({
        update: (state) => ({ ...state, done: true }),
        isDone: () => true,
        getWinnerIndexes: winnerSpy,
      }),
    );

    const result = service.update({ turn: 7, done: false }, { move: 2 }, 1, ["u1", "u2"]);

    expect(result?.done).toBe(true);
    expect(result?.winnerIndexes).toStrictEqual([1]);
    expect(winnerSpy).toHaveBeenCalledOnce();
  });
});
