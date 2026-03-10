import { type SafeUserInfo } from "./user.types.ts";

/**
 * Allows the backend to have access to the information about who is sending a friend request that can be used in the front end.
 */
export interface IncomingFriendRequestInfo {
  requestId: string;
  fromUser: SafeUserInfo;
}
