import { createRepo } from "./keyv.ts";
import type {
  AuthRecord,
  ChatRecord,
  CommentRecord,
<<<<<<< Updated upstream
  ConversationRecord,
  DirectMessageRecord,
=======
  FriendRequestRecord,
>>>>>>> Stashed changes
  GameRecord,
  MessageRecord,
  ThreadRecord,
  UserRecord,
  FriendRequestRecord,
} from "./models.ts";

export const AuthRepo = createRepo<AuthRecord>("auth");
export const ChatRepo = createRepo<ChatRecord>("chat");
export const CommentRepo = createRepo<CommentRecord>("comment");
export const FriendRequestRepo = createRepo<FriendRequestRecord>("friendRequest");
export const GameRepo = createRepo<GameRecord>("game");
export const MessageRepo = createRepo<MessageRecord>("message");
export const ThreadRepo = createRepo<ThreadRecord>("thread");
export const UserRepo = createRepo<UserRecord>("user");
export const FriendRequestRepo = createRepo<FriendRequestRecord>("friendRequest");
export const ConversationRepo = createRepo<ConversationRecord>("convo");
export const DirectMessageRepo = createRepo<DirectMessageRecord>("directmessage");
