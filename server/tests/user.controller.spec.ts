import express from "express";
import supertest from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileViewInfo, SafeUserInfo } from "@gamenite/shared";
import type { RestAPI } from "../src/types.ts";

vi.mock(import("../src/services/auth.service.ts"), () => ({
  checkAuth: vi.fn(),
  getUserByUsername: vi.fn(),
}));

vi.mock(import("../src/services/user.service.ts"), () => ({
  createUser: vi.fn(),
  getProfileViewByUsername: vi.fn(),
  getUsersByUsername: vi.fn(),
  populateSafeUserInfo: vi.fn(),
  searchUsersByUsername: vi.fn(),
  updateUser: vi.fn(),
}));

import {
  getByUsername,
  getSearch,
  postByUsername,
  postByUsernameView,
  postList,
  postLogin,
  postSignup,
} from "../src/controllers/user.controller.ts";
import { checkAuth, getUserByUsername } from "../src/services/auth.service.ts";
import {
  createUser,
  getProfileViewByUsername,
  getUsersByUsername,
  populateSafeUserInfo,
  searchUsersByUsername,
  updateUser,
} from "../src/services/user.service.ts";

const auth = { username: "user1", password: "pwd1111" };
const authedUser = { username: "user1", userId: "u1" };
const safeUser: SafeUserInfo = {
  username: "user1",
  display: "Yao",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  acceptGameInvites: true,
};

const profileView: ProfileViewInfo = {
  username: "user2",
  display: "Dos",
  createdAt: new Date("2025-01-01T00:00:00.000Z"),
  areFriends: false,
  canViewStats: true,
  stats: {
    games: [],
    favoriteGame: null,
    overallWinRate: 0,
  },
  personalInfoVisibility: "private",
  personalInfo: null,
};

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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("POST /api/user/login", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor("post", "/test", postLogin))
      .post("/test")
      .send({ username: "user1" });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 200 with invalid auth error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);

    const response = await supertest(restAppFor("post", "/test", postLogin))
      .post("/test")
      .send(auth);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ error: "Invalid username or password" });
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(populateSafeUserInfo).mockResolvedValue(safeUser);

    const response = await supertest(restAppFor("post", "/test", postLogin))
      .post("/test")
      .send(auth);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...safeUser,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
  });
});

describe("POST /api/user/:username", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor("post", "/test/:username", postByUsername))
      .post("/test/user1")
      .send({ auth, payload: 3 });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);

    const response = await supertest(restAppFor("post", "/test/:username", postByUsername))
      .post("/test/user1")
      .send({ auth, payload: { display: "new" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 403 when auth user does not match route username", async () => {
    vi.mocked(checkAuth).mockResolvedValue({ username: "user2", userId: "u2" });

    const response = await supertest(restAppFor("post", "/test/:username", postByUsername))
      .post("/test/user1")
      .send({ auth, payload: { display: "new" } });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("propagates uncaught service error", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(updateUser).mockRejectedValue(new Error("No user user1"));

    const req = {
      body: { auth, payload: { display: "new" } },
      params: { username: "user1" },
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };

    await expect(postByUsername(req as never, res as never)).rejects.toThrow("No user user1");
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(updateUser).mockResolvedValue(safeUser);

    const response = await supertest(restAppFor("post", "/test/:username", postByUsername))
      .post("/test/user1")
      .send({ auth, payload: { display: "new" } });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...safeUser,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
  });
});

describe("POST /api/user/signup", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor("post", "/test", postSignup))
      .post("/test")
      .send({ username: "user1" });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 200 for service error: user exists", async () => {
    vi.mocked(createUser).mockResolvedValue({ error: "User already exists" });

    const response = await supertest(restAppFor("post", "/test", postSignup))
      .post("/test")
      .send(auth);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ error: "User already exists" });
  });

  it("returns 200 for service error: disallowed username", async () => {
    vi.mocked(createUser).mockResolvedValue({ error: "That is not a permitted username" });

    const response = await supertest(restAppFor("post", "/test", postSignup))
      .post("/test")
      .send({ username: "signup", password: "pwd" });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ error: "That is not a permitted username" });
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(createUser).mockResolvedValue(safeUser);

    const response = await supertest(restAppFor("post", "/test", postSignup))
      .post("/test")
      .send(auth);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...safeUser,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
  });
});

describe("GET /api/user/:username", () => {
  it("returns 404 when user does not exist", async () => {
    vi.mocked(getUserByUsername).mockResolvedValue(null);

    const response = await supertest(restAppFor("get", "/test/:username", getByUsername)).get(
      "/test/ghost",
    );

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({ error: "User not found" });
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(getUserByUsername).mockResolvedValue(authedUser);
    vi.mocked(populateSafeUserInfo).mockResolvedValue(safeUser);

    const response = await supertest(restAppFor("get", "/test/:username", getByUsername)).get(
      "/test/user1",
    );

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...safeUser,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
  });
});

describe("POST /api/user/:username/view", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor("post", "/test/:username", postByUsernameView))
      .post("/test/user2")
      .send({ payload: {} });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 403 on invalid auth", async () => {
    vi.mocked(checkAuth).mockResolvedValue(null);

    const response = await supertest(restAppFor("post", "/test/:username", postByUsernameView))
      .post("/test/user2")
      .send({ auth, payload: {} });

    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("returns 404 when viewed user does not exist", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(getProfileViewByUsername).mockResolvedValue(null);

    const response = await supertest(restAppFor("post", "/test/:username", postByUsernameView))
      .post("/test/ghost")
      .send({ auth, payload: {} });

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({ error: "User not found" });
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(checkAuth).mockResolvedValue(authedUser);
    vi.mocked(getProfileViewByUsername).mockResolvedValue(profileView);

    const response = await supertest(restAppFor("post", "/test/:username", postByUsernameView))
      .post("/test/user2")
      .send({ auth, payload: {} });

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({
      ...profileView,
      createdAt: "2025-01-01T00:00:00.000Z",
    });
  });
});

describe("POST /api/user/list", () => {
  it("returns 400 on bad request body", async () => {
    const response = await supertest(restAppFor("post", "/test", postList))
      .post("/test")
      .send({ usernames: ["user1"] });

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("returns 200 with service error payload", async () => {
    vi.mocked(getUsersByUsername).mockRejectedValue(new Error("No user ghost"));

    const response = await supertest(restAppFor("post", "/test", postList))
      .post("/test")
      .send(["user1", "ghost"]);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ error: "Usernames do not all exist" });
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(getUsersByUsername).mockResolvedValue([safeUser]);

    const response = await supertest(restAppFor("post", "/test", postList))
      .post("/test")
      .send(["user1"]);

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([
      {
        ...safeUser,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("GET /api/user/search", () => {
  it("returns 400 when username query is missing", async () => {
    const response = await supertest(restAppFor("get", "/test", getSearch)).get("/test");

    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Username query required" });
  });

  it("returns 500 on service error", async () => {
    vi.mocked(searchUsersByUsername).mockRejectedValue(new Error("db down"));

    const response = await supertest(restAppFor("get", "/test", getSearch)).get(
      "/test?username=user",
    );

    expect(response.status).toBe(500);
    expect(response.body).toStrictEqual({ error: "Failed to search users" });
  });

  it("returns 200 on happy path", async () => {
    vi.mocked(searchUsersByUsername).mockResolvedValue([safeUser]);

    const response = await supertest(restAppFor("get", "/test", getSearch)).get(
      "/test?username=user",
    );

    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([
      {
        ...safeUser,
        createdAt: "2025-01-01T00:00:00.000Z",
      },
    ]);
  });
});
