import type { ErrorMsg, GameInfo, GameInviteInfo, GameKey, UserAuth } from "@gamenite/shared";
import { api, exceptionToErrorMsg } from "./api.ts";
import type { APIResponse } from "../util/types.ts";

const GAME_API_URL = `/api/game`;

/**
 * Sends a POST request to create a game
 */
export const createGame = async (
  auth: UserAuth,
  gameKey: GameKey,
  visibility: "public" | "private",
): APIResponse<GameInfo> => {
  try {
    const res = await api.post<GameInfo | ErrorMsg>(`${GAME_API_URL}/create`, {
      auth,
      payload: {
        type: gameKey,
        visibility: visibility,
      },
    });
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request to get a game
 */
export const getGameById = async (gameId: string): APIResponse<GameInfo> => {
  try {
    const res = await api.get<GameInfo | ErrorMsg>(`${GAME_API_URL}/${gameId}`);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a GET request for all games
 */
export const gameList = async (): APIResponse<GameInfo[]> => {
  try {
    const res = await api.get<GameInfo[] | ErrorMsg>(`${GAME_API_URL}/list`);
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};

/**
 * Sends a host invite for a user to join a game.
 */
export const inviteToGame = async (
  auth: UserAuth,
  payload: { gameId: string; toUsername: string },
): APIResponse<GameInviteInfo> => {
  try {
    const res = await api.post<GameInviteInfo | ErrorMsg>(
      `/api/game-invite/send`,
      {
        auth,
        payload,
      },
    );
    return res.data;
  } catch (error) {
    return exceptionToErrorMsg(error);
  }
};
