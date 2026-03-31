import {
  type ChatInfo,
  type ChatMoveLogPayload,
  type ChatNewMessagePayload,
  type ChatUserJoinedPayload,
  type ChatUserLeftPayload,
} from "./chat.types.ts";
import { type NewMessagePayload } from "./message.types.ts";
import { type WithAuth } from "./auth.types.ts";
import {
  type GameInfo,
  type GameMakeMovePayload,
  type GamePlayInfo,
  type TaggedGameView,
} from "./game.types.ts";
import { type SafeUserInfo } from "./user.types.ts";

/**
 * The Socket.io interface for client to server communication
 */
export interface ClientToServerEvents {
  chatJoin: (payload: WithAuth<string>) => void;
  chatLeave: (payload: WithAuth<string>) => void;
  chatSendMessage: (payload: WithAuth<NewMessagePayload>) => void;
  gameJoinAsPlayer: (payload: WithAuth<string>) => void;
  gameMakeMove: (payload: WithAuth<GameMakeMovePayload>) => void;
  gameStart: (payload: WithAuth<string>) => void;
  gameWatch: (payload: WithAuth<string>) => void;
  dmJoin: (payload: WithAuth<{ conversationId: string }>) => void;
  dmLeave: (payload: WithAuth<{ conversationId: string }>) => void;
  dmSendMessage: (payload: WithAuth<{ conversationId: string; text: string }>) => void;
}

/**
 * The Socket.io interface for server to client information
 */
export interface ServerToClientEvents {
  chatJoined: (payload: ChatInfo) => void;
  chatMoveLog: (payload: ChatMoveLogPayload) => void;
  chatNewMessage: (payload: ChatNewMessagePayload) => void;
  chatUserJoined: (payload: ChatUserJoinedPayload) => void;
  chatUserLeft: (payload: ChatUserLeftPayload) => void;
  gamePlayersUpdated: (payload: SafeUserInfo[]) => void;
  gameCreated: (payload: GameInfo) => void;
  gameStateUpdated: (payload: TaggedGameView & { forPlayer: boolean }) => void;
  gameWatched: (payload: GamePlayInfo) => void;
  dmJoined: (payload: {
    conversationId: string;
    messages: {
      id: string;
      text: string;
      sender: SafeUserInfo;
      createdAt: Date;
    }[];
  }) => void;

  dmNewMessage: (payload: {
    conversationId: string;
    message: {
      id: string;
      text: string;
      sender: SafeUserInfo;
      createdAt: Date;
    };
  }) => void;
}
