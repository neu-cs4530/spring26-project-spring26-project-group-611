import { describe, expect, it } from "vitest";
import supertest, { type Response } from "supertest";
import { app } from "../src/app.ts";

let response: Response;

const auth1 = { username: "user1", password: "pwd1111" };
const auth2 = { username: "user2", password: "pwd2222" };

async function makeFriends(): Promise<void> {
  const sendResponse = await supertest(app).post("/api/friend-request/send").send({
    auth: auth1,
    payload: { toUsername: "user2" },
  });

  expect(sendResponse.status).toBe(201);
  expect(sendResponse.body).toHaveProperty("id");

  const acceptResponse = await supertest(app).post("/api/friend-request/accept").send({
    auth: auth2,
    payload: { requestId: sendResponse.body.id },
  });

  expect(acceptResponse.status).toBe(200);
  expect(acceptResponse.body).toStrictEqual({ ok: true });
}

describe("POST /api/friend-request/send", () => {
  it("should return 400 on ill-formed payload", async () => {
    response = await supertest(app).post("/api/friend-request/send").send({ auth: auth1, payload: {} });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("should return 403 with bad auth", async () => {
    response = await supertest(app)
      .post("/api/friend-request/send")
      .send({ auth: { ...auth1, password: "wrong" }, payload: { toUsername: "user2" } });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should return a 400 service error when adding yourself", async () => {
    response = await supertest(app).post("/api/friend-request/send").send({
      auth: auth1,
      payload: { toUsername: "user1" },
    });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "You cannot send a friend request to yourself" });
  });

  it("should create a friend request with valid auth and payload", async () => {
    response = await supertest(app).post("/api/friend-request/send").send({
      auth: auth1,
      payload: { toUsername: "user2" },
    });

    expect(response.status).toBe(201);
    expect(response.body).toStrictEqual({
      id: expect.any(String),
      fromUsername: "user1",
      fromDisplay: "Yāo",
      toUsername: "user2",
      status: "pending",
      createdAt: expect.anything(),
    });
  });
});

describe("POST /api/friend-request/friends", () => {
  it("should return 400 on ill-formed payload", async () => {
    response = await supertest(app).post("/api/friend-request/friends").send({ auth: auth1 });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("should return 403 with bad auth", async () => {
    response = await supertest(app)
      .post("/api/friend-request/friends")
      .send({ auth: { ...auth1, password: "wrong" }, payload: {} });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should list accepted friends for the authenticated user", async () => {
    await makeFriends();

    response = await supertest(app).post("/api/friend-request/friends").send({ auth: auth1, payload: {} });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual([
      {
        username: "user2",
        display: "Sénior Dos",
        createdAt: expect.anything(),
        acceptGameInvites: true,
      },
    ]);
  });
});

describe("POST /api/friend-request/remove", () => {
  it("should return 400 on ill-formed payload", async () => {
    response = await supertest(app).post("/api/friend-request/remove").send({ auth: auth1, payload: {} });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "Poorly-formed request" });
  });

  it("should return 403 with bad auth", async () => {
    response = await supertest(app).post("/api/friend-request/remove").send({
      auth: { ...auth1, password: "wrong" },
      payload: { friendUsername: "user2" },
    });
    expect(response.status).toBe(403);
    expect(response.body).toStrictEqual({ error: "Invalid credentials" });
  });

  it("should return a 400 service error when users are not friends", async () => {
    response = await supertest(app).post("/api/friend-request/remove").send({
      auth: auth1,
      payload: { friendUsername: "user2" },
    });
    expect(response.status).toBe(400);
    expect(response.body).toStrictEqual({ error: "You are not friends with this user" });
  });

  it("should remove an existing friend", async () => {
    await makeFriends();

    response = await supertest(app).post("/api/friend-request/remove").send({
      auth: auth1,
      payload: { friendUsername: "user2" },
    });
    expect(response.status).toBe(200);
    expect(response.body).toStrictEqual({ ok: true });

    const friendsAfterRemoval = await supertest(app)
      .post("/api/friend-request/friends")
      .send({ auth: auth1, payload: {} });
    expect(friendsAfterRemoval.status).toBe(200);
    expect(friendsAfterRemoval.body).toStrictEqual([]);
  });
});