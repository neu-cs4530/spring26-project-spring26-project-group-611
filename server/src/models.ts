import type { GameKey } from "@gamenite/shared";

/**
 * Record identifiers used to look up keys in a database. This type
 * abbreviation is intended to suggest that the key should be a randomly
 * generated unique ID.
 */
export type RecordId = string;

/**
 * Actual JavaScript Date objects can't necessarily be stored in a database;
 * this type indicates that the string should be the result of taking a Date
 * object and turning it to a string with the Date.toISOString() method.
 */
export type DateISO = string;

/**
 * Represents a user's authorization record in the database.
 * - `user`: the user ID of the corresponding User model
 * - `password`: the password for this user
 */
export interface AuthRecord {
  userId: RecordId; // References User models
  password: string;
}

/**
 * Represents a chat document in the database.
 * - `messages`: the ordered list of messages in the chat
 * - `moveLog`: the ordered list of move log entries for this chat
 * - `createdAt`: when the chat was created
 */
export interface ChatRecord {
  messages: RecordId[]; // References Message models
  moveLog: MoveLogEntry[];
  createdAt: DateISO;
}

/**
 * Represents a game move log entry stored in a chat.
 * - `moveDescription`: human-readable description of the move
 * - `userId`: the user who made the move
 * - `createdAt`: when the move was made
 */
export interface MoveLogEntry {
  moveDescription: string;
  userId: RecordId;
  createdAt: DateISO;
}

/**
 * Represents a comment in the database.
 * - `text`: comment contents
 * - `createdBy`: username of the commenter
 * - `createdAt`: when the comment was made
 * - `editedAt`: when the comment was last modified
 */
export interface CommentRecord {
  text: string;
  createdBy: RecordId; // References User records
  createdAt: DateISO;
  editedAt?: DateISO;
}

/**
 * Represents a game document in the database.
 * - `type`: picks which game this is
 * - `state`: absent if the game hasn't started, or the id for the game's state
 * - `chat`: id for the game's chat
 * - `players`: active players for the game
 * - `createdAt`: when the game was created
 * - `createdBy`: username of the person who created the game
 * - `isPrivate`: whether the game is invite-only
 */
export interface GameRecord {
  type: GameKey;
  state?: unknown;
  done: boolean;
  chat: RecordId; // References Chat records
  players: RecordId[]; // References User records
  invitedPlayers?: RecordId[]; // References User records invited by the host
  createdAt: DateISO;
  createdBy: RecordId; // References User records
  isPrivate: boolean;
}

/**
 * Represents a message in the database.
 * - `text`: message contents
 * - `createdBy`: username of message sender
 * - `createdAt`: when the message was sent
 */
export interface MessageRecord {
  text: string;
  createdBy: RecordId; // References User records
  createdAt: DateISO;
}

/**
 * Represents a forum post as it's stored in the database.
 * - `title`: post title
 * - `text`: post contents
 * - `createdAt`: when the thread was posted
 * - `createdBy`: username of OP
 * - `comments`: replies to the post
 */
export interface ThreadRecord {
  title: string;
  text: string;
  createdAt: DateISO;
  createdBy: RecordId; // References User records
  comments: RecordId[]; // References Comment records
}

/**
 * Represents a user document in the database.
 * - `password`: user's password
 * - `display`: A display name
 * - `createdAt`: when this user registered.
 * - 'friends`: friends of this player
 * - `acceptGameInvites`: whether this user accepts game invitations from others
 */
export interface UserRecord {
  username: string; // References Auth records
  display: string;
  createdAt: DateISO;
  friends: RecordId[]; // adding this for the final project
  canViewStats: boolean;
  acceptGameInvites: boolean;
}

/**
 * Represents sending a friend request in the database.
 * - `fromUser`: User sending request
 * - `toUser`: User recieving request
 * - `status`: whether the request is pending, denied, or accepted
 * - 'createdAt`: the date the friend request was sent
 */
export interface FriendRequestRecord {
  fromUser: RecordId;
  toUser: RecordId;
  status: "pending" | "accepted" | "declined";
  createdAt: DateISO;
}

/**
 * Represents a game invite in the database.
 * - `gameId`: the game this invite is for
 * - `fromUser`: user ID of the host who sent the request
 * - `toUser`: user Id of the invited player
 * - `status`: the status of the invite
 * - `createdAt`: when the invite was sent
 */
export interface GameInviteRecord {
  gameId: RecordId;
  fromUser: RecordId;
  toUser: RecordId;
  status: "pending" | "accepted" | "declined";
  createdAt: DateISO;
}

/**
 * Represents a direct message in the database.
 * - `senderId`: the user who sent the message
 * - `text`: the message contents
 * - `createdAt`: when the message was sent
 */
export interface DirectMessageRecord {
  senderId: RecordId;
  text: string;
  createdAt: DateISO;
}

/**
 * Represents a direct message conversation between two users in the database.
 * - `participants`: the two users in the conversation
 * - `messages`: the ordered list of messages in the conversation
 * - `createdAt`: when the conversation was created
 */
export interface ConversationRecord {
  participants: RecordId[];
  messages: RecordId[];
  createdAt: DateISO;
}
