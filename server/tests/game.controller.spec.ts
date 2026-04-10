import express from "express";
import supertest from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GameInfo, TaggedGameView } from "@gamenite/shared";
import type { GameServer, GameServerSocket, GameViewUpdates, RestAPI } from "../src/types.ts";

const nimTaggedView: TaggedGameView = {
  type: "nim",
  view: { remaining: 10, nextPlayer: 0 },
};

const guessTaggedView: TaggedGameView = {
  type: "guess",
  view: { finished: false, guesses: [false, false] },
};

vi.mock(import("../src/services/auth.service.ts"), () => ({
  checkAuth: vi.fn(),
  enforceAuth: vi.fn(),
}));

vi.mock(import("../src/services/game.service.ts"), () => ({
  createGame: vi.fn(),
  getGameById: vi.fn(),
  getGames: vi.fn(),
  invitePlayerToGame: vi.fn(),
  kickPlayer: vi.fn(),
  viewGame: vi.fn(),
  joinGame: vi.fn(),
  startGame: vi.fn(),
  updateGame: vi.fn(),
  gameServices: {
    nim: {
      minPlayers: 2,
      maxPlayers: 2,
      create: vi.fn(() => ({
        state: {},
        views: {
          watchers: nimTaggedView,
          players: [{ userId: "u3", view: nimTaggedView }],
        },
      })),
      view: vi.fn(() => nimTaggedView),
      update: vi.fn(() => null),
    },
    guess: {
      minPlayers: 2,
      maxPlayers: 4,
      create: vi.fn(() => ({
        state: {},
        views: {
          watchers: guessTaggedView,
          players: [{ userId: "u3", view: guessTaggedView }],
        },
      })),
      view: vi.fn(() => guessTaggedView),
      update: vi.fn(() => null),
    },
  },
}));

vi.mock(import("../src/services/chat.service.ts"), () => ({
  addMoveLogToChat: vi.fn(),
}));

vi.mock(import("../src/services/game.invite.service.ts"), () => ({
  acceptPendingInvitesForGame: vi.fn(),
}));

vi.mock(import("../src/controllers/socket.controller.ts"), () => ({
  logSocketError: vi.fn(),
}));

import {
  getById,
  getList,
  postCreate,
  postInvite,
  postKick,
  setGameRealtimeServer,
  socketJoinAsPlayer,
  socketMakeMove,
  socketStart,
  socketWatch,
} from "../src/controllers/game.controller.ts";
import { checkAuth, enforceAuth } from "../src/services/auth.service.ts";
import {
  createGame,
  getGameById,
  getGames,
  invitePlayerToGame,
  joinGame,
  kickPlayer,
  startGame,
  updateGame,
  viewGame,
} from "../src/services/game.service.ts";
import { addMoveLogToChat } from "../src/services/chat.service.ts";
import { acceptPendingInvitesForGame } from "../src/services/game.invite.service.ts";
import { logSocketError } from "../src/controllers/socket.controller.ts";

const auth = { username: "user3", password: "pwd3333" };
const user = { username: "user3", userId: "u3" };
const MOCK_PLAYERS = [
  {
    username: "user3",
    display: "Frau Drei",
    createdAt: new Date("2025-01-01T00:00:00.000Z"),
    acceptGameInvites: true,
  },
];

function restAppFor<R = unknown, P extends { [key: string]: string } = { [key: string]: string }>(
  method: "get" | "post",
  path: string,
  handler: RestAPI<R, P>,
) {
  const app = express();
  app.use(express.json());
  app[method](path, (req, res) => {
    void handler(
      req as never as Parameters<RestAPI<R, P>>[0],
      res as never as Parameters<RestAPI<R, P>>[1],
    );
  });
  return app;
}

class MockGameServer {
  to = vi.fn(() => this);
  emit = vi.fn();
}

class MockGameServerSocket {
  id = "socket1";
  rooms = new Set<string>();
  join = vi.fn((roomOrRooms: string | string[]) => {
    if (Array.isArray(roomOrRooms)) {
      roomOrRooms.forEach((room) => this.rooms.add(room));
    } else {
      this.rooms.add(roomOrRooms);
    }
  });
  leave = vi.fn((room: string) => {
    this.rooms.delete(room);
  });
  emit = vi.fn();
  to = vi.fn(() => this);
}

beforeEach(() => {
  vi.resetAllMocks();
  setGameRealtimeServer(new MockGameServer() as unknown as GameServer);
});

describe("POST /api/game/create", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor("post", "/test", postCreate))
      .post("/test")
      .send({ auth, payload: 3 });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);

    const response = await supertest(restAppFor("post", "/test", postCreate))
      .post("/test")
      .send({ auth, payload: { type: "nim", visibility: "public" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    const created: GameInfo = {
      gameId: "g1",
      type: "nim",
      status: "waiting",
      chat: "c1",
      players: MOCK_PLAYERS,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      createdBy: MOCK_PLAYERS[0],
      minPlayers: 2,
      maxPlayers: 2,
      visibility: "public",
    };
    vi.mocked(createGame).mockResolvedValue(created);

    const io = new MockGameServer();
    setGameRealtimeServer(io as unknown as GameServer);

    const response = await supertest(restAppFor("post", "/test", postCreate))
      .post("/test")
      .send({ auth, payload: { type: "nim", visibility: "public" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...created,
      createdAt: "2025-01-01T00:00:00.000Z",
      createdBy: {
        ...created.createdBy,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
      players: [{ ...created.players[0], createdAt: "2025-01-01T00:00:00.000Z" }],
    });
    expect(io.emit).toHaveBeenCalledExactlyOnceWith("gameCreated", created);
  });
});

describe("GET /api/game/:id", () => {
  it("returns 404 when game does not exist", async () => {
    vi.mocked(getGameById).mockResolvedValue(null);

    const response = await supertest(restAppFor("get", "/test/:id", getById)).get("/test/abc");

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({ error: "Game not found" });
  });

  it("returns 200 on happy path", async () => {
    const game: GameInfo = {
      gameId: "g1",
      type: "nim",
      status: "waiting",
      chat: "c1",
      players: MOCK_PLAYERS,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      createdBy: MOCK_PLAYERS[0],
      minPlayers: 2,
      maxPlayers: 2,
      visibility: "public",
    };
    vi.mocked(getGameById).mockResolvedValue(game);

    const response = await supertest(restAppFor("get", "/test/:id", getById)).get("/test/g1");

    expect(response.status).toBe(200);
    expect(response.body.gameId).toBe("g1");
  });
});

describe("GET /api/game/list", () => {
  it("returns 200 on happy path", async () => {
    vi.mocked(getGames).mockResolvedValue([]);

    const response = await supertest(restAppFor("get", "/test", getList)).get("/test");

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([]);
  });
});

describe("POST /api/game/invite", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor("post", "/test", postInvite))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);

    const response = await supertest(restAppFor("post", "/test", postInvite))
      .post("/test")
      .send({ auth, payload: { gameId: "g1", toUsername: "user2" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 for each service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    const errors = [
      "user user3 inviting to invalid game",
      "user user3 inviting to game they do not host",
      "user user3 inviting nonexistent user",
      "user user3 inviting player already in game",
      "user user3 inviting with invalid host id",
      "You can only invite friends to a private game",
      "user user3 inviting user already invited",
    ];

    for (const error of errors) {
      vi.mocked(invitePlayerToGame).mockRejectedValueOnce(new Error(error));
      const response = await supertest(restAppFor("post", "/test", postInvite))
        .post("/test")
        .send({ auth, payload: { gameId: "g1", toUsername: "user2" } });
      expect(response.status).toBe(400);
      expect(response.body).toStrictEqual({ error });
    }
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    vi.mocked(invitePlayerToGame).mockResolvedValue({ gameId: "g1", toUsername: "user2" });

    const response = await supertest(restAppFor("post", "/test", postInvite))
      .post("/test")
      .send({ auth, payload: { gameId: "g1", toUsername: "user2" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ gameId: "g1", toUsername: "user2" });
  });
});

describe("POST /api/game/kick", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor("post", "/test", postKick))
      .post("/test")
      .send({ auth, payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);

    const response = await supertest(restAppFor("post", "/test", postKick))
      .post("/test")
      .send({ auth, payload: { gameId: "g1", username: "user2" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 400 for each service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    const errors = [
      "user user3 kicking from invalid game",
      "user user3 kicking from game they do not host",
      "cannot kick players after a game has started",
      "host cannot kick themselves",
      "user user2 does not exist",
      "user user2 is not in this game",
    ];

    for (const error of errors) {
      vi.mocked(kickPlayer).mockRejectedValueOnce(new Error(error));
      const response = await supertest(restAppFor("post", "/test", postKick))
        .post("/test")
        .send({ auth, payload: { gameId: "g1", username: "user2" } });
      expect(response.status).toBe(400);
      expect(response.body).toStrictEqual({ error });
    }
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(user);
    const kicked: GameInfo = {
      gameId: "g1",
      type: "nim",
      status: "waiting",
      chat: "c1",
      players: MOCK_PLAYERS,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      createdBy: MOCK_PLAYERS[0],
      minPlayers: 2,
      maxPlayers: 2,
      visibility: "public",
    };
    vi.mocked(kickPlayer).mockResolvedValue(kicked);

    const io = new MockGameServer();
    setGameRealtimeServer(io as unknown as GameServer);

    const response = await supertest(restAppFor("post", "/test", postKick))
      .post("/test")
      .send({ auth, payload: { gameId: "g1", username: "user2" } });

    expect(response.status).toBe(200);
    expect(response.body.gameId).toBe("g1");
    expect(io.to).toHaveBeenCalledExactlyOnceWith("g1");
    expect(io.emit).toHaveBeenCalledExactlyOnceWith("gamePlayersUpdated", kicked.players);
  });
});

describe("game sockets", () => {
  it("socketWatch parse failure logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketWatch(socket, io)({ auth, payload: 3 });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("socketWatch enforceAuth failure logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockRejectedValue(new Error("Invalid auth"));

    await socketWatch(socket, io)({ auth, payload: "g1" });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it("socketWatch success joins rooms and emits watched/player updates", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    const view: TaggedGameView = { type: "nim", view: {} as never };
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(viewGame).mockResolvedValue({ isPlayer: true, view, players: MOCK_PLAYERS });

    await socketWatch(socket, io)({ auth, payload: "g1" });

    expect(socket.join).toHaveBeenCalledExactlyOnceWith(["g1", "g1-u3"]);
    expect(socket.emit).toHaveBeenNthCalledWith(1, "gameWatched", {
      gameId: "g1",
      view,
      players: MOCK_PLAYERS,
    });
    expect(socket.emit).toHaveBeenNthCalledWith(2, "gamePlayersUpdated", MOCK_PLAYERS);
  });

  it("socketJoinAsPlayer parse failure logs and emits gameJoinError", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketJoinAsPlayer(socket, io)({ auth, payload: 3 });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith("gameJoinError", expect.any(String));
  });

  it("socketJoinAsPlayer enforceAuth failure logs and emits gameJoinError", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    vi.mocked(enforceAuth).mockRejectedValue(new Error("Invalid auth"));

    await socketJoinAsPlayer(socket, io)({ auth, payload: "g1" });

    expect(logSocketError).toHaveBeenCalledOnce();
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith("gameJoinError", "Invalid auth");
  });

  it("socketJoinAsPlayer success joins user room and accepts pending invites", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    const game = {
      gameId: "g1",
      type: "nim" as const,
      players: MOCK_PLAYERS,
      chat: "c1",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      createdBy: MOCK_PLAYERS[0],
      status: "waiting" as const,
      minPlayers: 2,
      maxPlayers: 2,
      visibility: "public" as const,
    };

    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(joinGame).mockResolvedValue(game);

    const realtime = new MockGameServer();
    setGameRealtimeServer(realtime as unknown as GameServer);

    await socketJoinAsPlayer(socket, io)({ auth, payload: "g1" });

    expect(acceptPendingInvitesForGame).toHaveBeenCalledExactlyOnceWith("u3", "g1");
    expect(realtime.to).toHaveBeenCalledExactlyOnceWith("g1");
    expect(realtime.emit).toHaveBeenCalledExactlyOnceWith("gamePlayersUpdated", game.players);
    expect(socket.join).toHaveBeenCalledWith("g1-u3");
  });

  it("socketJoinAsPlayer starts game automatically when full", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    const fullPlayers = [...MOCK_PLAYERS, { ...MOCK_PLAYERS[0], username: "user2" }];
    const game = {
      gameId: "g1",
      type: "nim" as const,
      players: fullPlayers,
      chat: "c1",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      createdBy: MOCK_PLAYERS[0],
      status: "waiting" as const,
      minPlayers: 2,
      maxPlayers: 2,
      visibility: "public" as const,
    };
    const updates: GameViewUpdates = {
      watchers: nimTaggedView,
      players: [{ userId: "u3", view: nimTaggedView }],
    };

    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(joinGame).mockResolvedValue(game);
    vi.mocked(startGame).mockResolvedValue(updates);

    await socketJoinAsPlayer(socket, io)({ auth, payload: "g1" });

    expect(startGame).toHaveBeenCalledExactlyOnceWith("g1", user);
    expect(io.to).toHaveBeenCalledWith("g1");
  });

  it("socketStart parse failure logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketStart(socket, io)({ auth, payload: 3 });

    expect(logSocketError).toHaveBeenCalledOnce();
  });

  it("socketStart success sends updates", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    const updates: GameViewUpdates = {
      watchers: nimTaggedView,
      players: [{ userId: "u3", view: nimTaggedView }],
    };

    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(startGame).mockResolvedValue(updates);

    await socketStart(socket, io)({ auth, payload: "g1" });

    expect(io.to).toHaveBeenCalledWith("g1");
  });

  it("socketMakeMove parse failure logs error", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;

    await socketMakeMove(socket, io)({ auth, payload: { gameId: "g1" } });

    expect(logSocketError).toHaveBeenCalledOnce();
  });

  it("socketMakeMove success updates game and emits move log", async () => {
    const socket = new MockGameServerSocket() as unknown as GameServerSocket;
    const io = new MockGameServer() as unknown as GameServer;
    const updates: GameViewUpdates = {
      watchers: nimTaggedView,
      players: [{ userId: "u3", view: nimTaggedView }],
    };
    vi.mocked(enforceAuth).mockResolvedValue(user);
    vi.mocked(updateGame).mockResolvedValue({
      views: updates,
      moveDescription: "removed 1 from pile 1",
      chatId: "chat1",
    });
    vi.mocked(addMoveLogToChat).mockResolvedValue({
      chatId: "chat1",
      moveDescription: "user3 removed 1 from pile 1",
      user: MOCK_PLAYERS[0],
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
    });

    await socketMakeMove(
      socket,
      io,
    )({
      auth,
      payload: { gameId: "g1", move: { pile: 1, count: 1 } },
    });

    expect(io.to).toHaveBeenCalledWith("chat1");
    expect(io.emit).toHaveBeenCalledWith(
      "chatMoveLog",
      expect.objectContaining({ chatId: "chat1" }),
    );
  });
});
