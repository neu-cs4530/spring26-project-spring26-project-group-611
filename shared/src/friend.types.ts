import { z } from "zod";

/**
 * The possible states of a friend request
 */
export type FriendRequestStatus = "pending" | "accepted" | "declined";

/**
 * A friend request as exposed to clients
 * - `id`: unique identifier of this request (key)
 * - `fromUsername`: who sent the request
 * - `toUsername`: who recieved the request
 * - `status`: current status
 * - `createdAt` : when the request was created
 */
export interface FriendRequestInfo {
  id: string;
  fromUsername: string;
  fromDisplay: string;
  toUsername: string;
  status: FriendRequestStatus;
  createdAt: Date;
}

/**
 * Zod schema + type for sending a friend request
 */
export type SendFriendRequestPayload = z.infer<typeof zSendFriendRequestPayload>;
export const zSendFriendRequestPayload = z.object({
  toUsername: z.string(),
});
