import { createRepo } from "./keyv.ts";
import type {
  AuthRecord,
  ChatRecord,
  CommentRecord,
  ConversationRecord,
  DirectMessageRecord,
  FriendRequestRecord,
  GameRecord,
  MessageRecord,
  ThreadRecord,
  UserRecord,
} from "./models.ts";

export const AuthRepo = createRepo<AuthRecord>("auth");
export const ChatRepo = createRepo<ChatRecord>("chat");
export const CommentRepo = createRepo<CommentRecord>("comment");
export const GameRepo = createRepo<GameRecord>("game");
export const MessageRepo = createRepo<MessageRecord>("message");
export const ThreadRepo = createRepo<ThreadRecord>("thread");
export const UserRepo = createRepo<UserRecord>("user");
export const FriendRequestRepo = createRepo<FriendRequestRecord>("friendRequest");
export const ConversationRepo = createRepo<ConversationRecord>("convo");
export const DirectMessageRepo = createRepo<DirectMessageRecord>("directmessage");
