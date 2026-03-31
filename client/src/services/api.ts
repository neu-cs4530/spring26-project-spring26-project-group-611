import type { ErrorMsg, SafeUserInfo, UserAuth } from "@gamenite/shared";
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

/**
 * Function to handle successful responses
 */
const handleRes = (res: AxiosResponse) => res;

/**
 * Function to handle errors
 */
const handleErr = (err: AxiosError) => {
  return Promise.reject(err);
};

export const api = axios.create({ withCredentials: true });

/**
 * Add a request interceptor to the Axios instance.
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => config,
  (error: AxiosError) => handleErr(error),
);

/**
 * Add a response interceptor to the Axios instance.
 */
api.interceptors.response.use(
  (response: AxiosResponse) => handleRes(response),
  (error: AxiosError) => handleErr(error),
);

/**
 *
 * @param error An unknown exception
 * @returns An error message
 */
export function exceptionToErrorMsg(error: unknown): ErrorMsg {
  if (axios.isAxiosError(error) && error.response) {
    // check if the response data contain an error message
    if (
      error.response.data &&
      typeof error.response.data === "object" &&
      "error" in error.response.data
    ) {
      return { error: (error.response.data as { error: string }).error };
    }
    return { error: `Error during request: ${error.response.statusText}` };
  } else {
    return { error: "Error during request" };
  }
}

type DmStartResponse = { id: string } | ErrorMsg;

type DmMessageResponse = {
  id: string;
  text: string;
  sender: SafeUserInfo;
  createdAt: string | Date;
};

type DmMessagesResponse = DmMessageResponse[] | ErrorMsg;

export async function getOrCreateConversation(
  auth: UserAuth,
  username: string,
): Promise<DmStartResponse> {
  const res: AxiosResponse<DmStartResponse> = await api.post("/api/dm/start", {
    auth,
    payload: { username },
  });
  return res.data;
}

export async function getMessages(
  auth: UserAuth,
  conversationId: string,
): Promise<DmMessagesResponse> {
  const res: AxiosResponse<DmMessagesResponse> = await api.post("/api/dm/messages", {
    auth,
    payload: { conversationId },
  });
  return res.data;
}

export async function sendMessage(
  auth: UserAuth,
  conversationId: string,
  text: string,
): Promise<DmMessageResponse | ErrorMsg> {
  const res: AxiosResponse<DmMessageResponse | ErrorMsg> = await api.post("/api/dm/send", {
    auth,
    payload: { conversationId, text },
  });
  return res.data;
}
