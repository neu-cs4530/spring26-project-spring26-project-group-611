/* eslint no-console: "off" */

import express, { Router } from "express";
import { Server } from "socket.io";
import { withAuth } from "@gamenite/shared";
import { z } from "zod";
import * as http from "node:http";

import * as chat from "./controllers/chat.controller.ts";
import * as game from "./controllers/game.controller.ts";
import * as gameInvite from "./controllers/game.invite.controller.ts";
import * as user from "./controllers/user.controller.ts";
import * as thread from "./controllers/thread.controller.ts";
import * as dm from "./controllers/dm.controller.ts";

import {
  postSend as friendPostSend,
  postAccept as friendPostAccept,
  postDecline as friendPostDecline,
  postIncoming as friendPostIncoming,
  postOutgoing as friendPostOutgoing,
  postFriends as friendPostFriends,
  postCancel as friendPostCancel,
  postRemove as friendPostRemove,
  setFriendRealtimeServer,
} from "./controllers/friends.controller.ts";

import { type GameServer } from "./types.ts";
import { enforceAuth } from "./services/auth.service.ts";
import { logSocketError } from "./controllers/socket.controller.ts";

export const app = express();
export const httpServer = http.createServer(app);
const io: GameServer = new Server(httpServer);

game.setGameRealtimeServer(io);
setFriendRealtimeServer(io);

const zUserSubscriptionPayload = withAuth(z.object({}).strict());

app.use(express.json());

app.use(
  "/api",
  Router()
    .use(
      "/game",
      express
        .Router()
        .post("/create", game.postCreate)
        .post("/invite", game.postInvite)
        .post("/kick", game.postKick)
        .get("/list", game.getList)
        .get("/:id", game.getById),
    )
    .use(
      "/thread",
      express
        .Router()
        .post("/create", thread.postCreate)
        .get("/list", thread.getList)
        .get("/:id", thread.getById)
        .post("/:id/comment", thread.postByIdComment),
    )
    .use(
      "/user",
      Router()
        .post("/list", user.postList)
        .post("/login", user.postLogin)
        .post("/signup", user.postSignup)
        .post("/:username/view", user.postByUsernameView)
        .get("/search", user.getSearch)
        .post("/:username", user.postByUsername)
        .get("/:username", user.getByUsername),
    )
    .use(
      "/friend-request",
      Router()
        .post("/send", friendPostSend)
        .post("/accept", friendPostAccept)
        .post("/decline", friendPostDecline)
        .post("/incoming", friendPostIncoming)
        .post("/outgoing", friendPostOutgoing)
        .post("/friends", friendPostFriends)
        .post("/cancel", friendPostCancel)
        .post("/remove", friendPostRemove),
    )
    .use(
      "/game-invite",
      Router()
        .post("/send", gameInvite.postSend)
        .post("/incoming", gameInvite.postIncoming)
        .post("/outgoing", gameInvite.postOutgoing)
        .post("/accept", gameInvite.postAccept)
        .post("/decline", gameInvite.postDecline)
        .post("/toggle-accept", gameInvite.postToggleAccept),
    )
    .use(
      "/dm",
      Router()
        .post("/start", dm.postStart)
        .post("/send", dm.postSend)
        .post("/messages", dm.postMessages),
    ),
);

io.on("connection", (socket) => {
  const socketId = socket.id;
  console.log(`CONN [${socketId}] connected`);

  socket.on("disconnect", () => {
    console.log(`CONN [${socketId}] disconnected`);
  });

  socket.on("userSubscribe", async (body) => {
    try {
      const parsed = zUserSubscriptionPayload.parse(body);
      const userRecord = await enforceAuth(parsed.auth);
      const nextRoom = `user-${userRecord.userId}`;

      const currentRoom = (socket.data as { userRoom?: string }).userRoom;
      if (currentRoom === nextRoom) {
        return;
      }

      if (currentRoom) {
        await socket.leave(currentRoom);
      }

      await socket.join(nextRoom);
      (socket.data as { userRoom?: string }).userRoom = nextRoom;
    } catch (err) {
      logSocketError(socket, err);
    }
  });

  socket.on("userUnsubscribe", async (body) => {
    try {
      const parsed = zUserSubscriptionPayload.parse(body);
      await enforceAuth(parsed.auth);

      const currentRoom = (socket.data as { userRoom?: string }).userRoom;
      if (!currentRoom) {
        return;
      }

      await socket.leave(currentRoom);
      (socket.data as { userRoom?: string }).userRoom = undefined;
    } catch (err) {
      logSocketError(socket, err);
    }
  });

  socket.on("chatJoin", chat.socketJoin(socket, io));
  socket.on("chatLeave", chat.socketLeave(socket, io));
  socket.on("chatSendMessage", chat.socketSendMessage(socket, io));

  socket.on("gameJoinAsPlayer", game.socketJoinAsPlayer(socket, io));
  socket.on("gameMakeMove", game.socketMakeMove(socket, io));
  socket.on("gameStart", game.socketStart(socket, io));
  socket.on("gameWatch", game.socketWatch(socket, io));

  socket.on("dmJoin", dm.socketJoin(socket, io));
  socket.on("dmLeave", dm.socketLeave(socket, io));
  socket.on("dmSendMessage", dm.socketSendMessage(socket, io));

  socket.on("gameInviteJoin", gameInvite.socketJoin(socket, io));
  socket.on("gameInviteLeave", gameInvite.socketLeave(socket, io));

  socket.onAny((name, payload) => {
    const zPayload = z.object({
      auth: z.object({ username: z.string() }),
      payload: z.any(),
    });

    const checked = zPayload.safeParse(payload);

    if (checked.error) {
      console.log(`RECV error: ${checked.error.message}`);
    } else {
      console.log(
        `RECV [${socketId}] got ${name} ${checked.data.auth.username} ${JSON.stringify(
          checked.data.payload,
        )}`,
      );
    }
  });

  socket.onAnyOutgoing((name) => {
    console.log(`SEND [${socketId}] gets ${name}`);
  });
});
