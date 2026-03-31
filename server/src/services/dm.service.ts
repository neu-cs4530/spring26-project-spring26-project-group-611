import { ConversationRepo, DirectMessageRepo, UserRepo } from "../repository.ts";
import { getUserByUsername } from "./auth.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { areFriends } from "./friend.service.ts";
import type { SafeUserInfo } from "@gamenite/shared";

type DmStartResult = { id: string } | { error: string };

type DmMessageInfo = {
  id: string;
  text: string;
  sender: SafeUserInfo;
  createdAt: Date;
};

type DmMessageResult = DmMessageInfo | { error: string };
type DmMessagesResult = DmMessageInfo[] | { error: string };

/**
 * Get or create a conversation between two friends
 */
export async function getOrCreateConversation(
  currentUsername: string,
  otherUsername: string,
): Promise<DmStartResult> {
  if (currentUsername === otherUsername) {
    return { error: "Cannot message yourself" };
  }

  const current = await getUserByUsername(currentUsername);
  const other = await getUserByUsername(otherUsername);

  if (!current || !other) {
    return { error: "User not found" };
  }

  const isFriends = await areFriends(currentUsername, otherUsername);
  if (!isFriends) {
    return { error: "You can only message friends" };
  }

  const keys = await ConversationRepo.getAllKeys();

  for (const key of keys) {
    const convo = await ConversationRepo.find(key);
    if (!convo) continue;

    const participants = convo.participants ?? [];

    if (
      participants.includes(current.userId) &&
      participants.includes(other.userId) &&
      participants.length === 2
    ) {
      return { id: key };
    }
  }

  const id = await ConversationRepo.add({
    participants: [current.userId, other.userId],
    createdAt: new Date().toISOString(),
    messages: [],
  });

  return { id };
}

/**
 * Send a direct message to a friend
 */
export async function sendDirectMessage(
  currentUsername: string,
  conversationId: string,
  text: string,
): Promise<DmMessageResult> {
  const current = await getUserByUsername(currentUsername);
  if (!current) {
    return { error: "User not found" };
  }

  const convo = await ConversationRepo.find(conversationId);
  if (!convo) {
    return { error: "Conversation not found" };
  }

  if (!convo.participants.includes(current.userId)) {
    return { error: "Not part of this conversation" };
  }

  const otherUserId = convo.participants.find((id) => id !== current.userId);
  if (!otherUserId) {
    return { error: "Conversation is invalid" };
  }

  const currentUserRecord = await UserRepo.find(current.userId);
  if (!currentUserRecord) {
    return { error: "User not found" };
  }

  const stillFriends = (currentUserRecord.friends ?? []).includes(otherUserId);
  if (!stillFriends) {
    return { error: "You are no longer friends" };
  }

  const messageId = await DirectMessageRepo.add({
    conversationId,
    senderId: current.userId,
    text,
    createdAt: new Date().toISOString(),
  });

  convo.messages = convo.messages ?? [];
  convo.messages.push(messageId);
  await ConversationRepo.set(conversationId, convo);

  return {
    id: messageId,
    text,
    sender: await populateSafeUserInfo(current.userId),
    createdAt: new Date(),
  };
}

/**
 * Get all messages in a conversation
 */
export async function getMessages(
  currentUsername: string,
  conversationId: string,
): Promise<DmMessagesResult> {
  const current = await getUserByUsername(currentUsername);
  if (!current) {
    return { error: "User not found" };
  }

  const convo = await ConversationRepo.find(conversationId);
  if (!convo) {
    return { error: "Conversation not found" };
  }

  if (!convo.participants.includes(current.userId)) {
    return { error: "Not authorized" };
  }

  const results: DmMessageInfo[] = [];

  for (const id of convo.messages ?? []) {
    const msg = await DirectMessageRepo.find(id);
    if (!msg) continue;

    results.push({
      id,
      text: msg.text,
      sender: await populateSafeUserInfo(msg.senderId),
      createdAt: new Date(msg.createdAt),
    });
  }

  return results;
}
