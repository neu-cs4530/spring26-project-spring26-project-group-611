import type { ErrorMsg, GameInviteInfo, UserAuth } from "@gamenite/shared";
import { api, exceptionToErrorMsg } from "./api.ts";
import type { APIResponse } from "../util/types.ts";

const GAME_INVITE_API_URL = `/api/game-invite`;

/**
 * Sends a POST request to get all pending incoming game invites for the user
 */
export const getIncomingGameInvites = async (auth: UserAuth): APIResponse<GameInviteInfo[]> => {
  try {
    const res = await api.post<GameInviteInfo[] | ErrorMsg>(`${GAME_INVITE_API_URL}/incoming`, {
      auth,
      payload: {},
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to accept a game invite
 */
export const acceptGameInvite = async (
  auth: UserAuth,
  inviteId: string,
): APIResponse<GameInviteInfo> => {
  try {
    const res = await api.post<GameInviteInfo | ErrorMsg>(
      `${GAME_INVITE_API_URL}/accept`,
      {
        auth,
        payload: { inviteId },
      },
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a POST request to decline a game invite
 */
export const declineGameInvite = async (
  auth: UserAuth,
  inviteId: string,
): APIResponse<GameInviteInfo> => {
  try {
    const res = await api.post<GameInviteInfo | ErrorMsg>(
      `${GAME_INVITE_API_URL}/decline`,
      {
        auth,
        payload: { inviteId },
      },
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
