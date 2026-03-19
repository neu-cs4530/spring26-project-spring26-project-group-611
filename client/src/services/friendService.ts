import type { ErrorMsg, FriendRequestInfo, SafeUserInfo, UserAuth } from "@gamenite/shared";
import { api, exceptionToErrorMsg } from "./api";
import type { APIResponse } from "../util/types";

const FRIEND_REQUEST_API_URL = `/api/friend-request`;

/**
 * Sends a friend request from the authenticated user to `toUsername`
 */
export const sendFriendRequest = async (
  auth: UserAuth,
  toUsername: string,
): APIResponse<FriendRequestInfo> => {
  try {
    const res = await api.post<FriendRequestInfo | ErrorMsg>(`${FRIEND_REQUEST_API_URL}/send`, {
      auth,
      payload: { toUsername },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Accepts a pending friend request for the authenticated user.
 */
export const acceptFriendRequest = async (
  auth: UserAuth,
  requestId: string,
): APIResponse<{ ok: true }> => {
  try {
    const res = await api.post<{ ok: true } | ErrorMsg>(`${FRIEND_REQUEST_API_URL}/accept`, {
      auth,
      payload: { requestId },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Returns all pending friend requests sent to the authenticated user.
 */
export const getIncomingFriendRequests = async (
  auth: UserAuth,
): APIResponse<FriendRequestInfo[]> => {
  try {
    const res = await api.post<FriendRequestInfo[] | ErrorMsg>(
      `${FRIEND_REQUEST_API_URL}/incoming`,
      {
        auth,
        payload: {},
      },
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Returns all pending friend requests sent by the authenticated user.
 */
export const getOutgoingFriendRequests = async (
  auth: UserAuth,
): APIResponse<FriendRequestInfo[]> => {
  try {
    const res = await api.post<FriendRequestInfo[] | ErrorMsg>(
      `${FRIEND_REQUEST_API_URL}/outgoing`,
      {
        auth,
        payload: {},
      },
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Returns all accepted friends for the authenticated user.
 */
export const getCurrentFriends = async (auth: UserAuth): APIResponse<SafeUserInfo[]> => {
  try {
    const res = await api.post<SafeUserInfo[] | ErrorMsg>(`${FRIEND_REQUEST_API_URL}/friends`, {
      auth,
      payload: {},
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const declineFriendRequest = async (
  auth: UserAuth,
  requestId: string,
): APIResponse<{ ok: true }> => {
  try {
    const res = await api.post<{ ok: true } | ErrorMsg>(`${FRIEND_REQUEST_API_URL}/decline`, {
      auth,
      payload: { requestId },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

export const cancelFriendRequest = async (
  auth: UserAuth,
  requestId: string,
): APIResponse<{ ok: true }> => {
  try {
    const res = await api.post<{ ok: true } | ErrorMsg>(`/api/friend-request/cancel`, {
      auth,
      payload: { requestId },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
