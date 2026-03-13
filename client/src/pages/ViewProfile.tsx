import type { ProfileViewInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useTimeSince from "../hooks/useTimeSince";
import useLoginContext from "../hooks/useLoginContext";
import { viewProfile } from "../services/userService";
import { sendFriendRequest } from "../services/friendService";

interface ViewProfileProps {
  username: string;
}
export default function ViewProfile({ username }: ViewProfileProps) {
  const { user, pass } = useLoginContext();
  const [componentState, setComponentState] = useState<
    | { type: "waiting" }
    | { type: "error"; msg: string }
    | { type: "profile"; user: ProfileViewInfo }
  >({ type: "waiting" });
  const [requestState, setRequestState] = useState<
    { type: "idle" } | { type: "sending" } | { type: "sent" } | { type: "error"; msg: string }
  >({ type: "idle" });
  const timeSince = useTimeSince();

  useEffect(() => {
    let cancel = false;

    viewProfile({ username: user.username, password: pass }, username)
      .then((response) => {
        if (cancel) return;
        if ("error" in response) {
          setComponentState({ type: "error", msg: response.error });
        } else {
          setComponentState({ type: "profile", user: response });
        }
      })
      .catch((err) => {
        if (cancel) return;
        setComponentState({ type: "error", msg: `${err}` });
      });

    return () => {
      cancel = true;
    };
  }, [username, user.username, pass]);

  const handleSendRequest = () => {
    setRequestState({ type: "sending" });
    sendFriendRequest({ username: user.username, password: pass }, username)
      .then((res) => {
        if ("error" in res) {
          setRequestState({ type: "error", msg: res.error });
        } else {
          setRequestState({ type: "sent" });
        }
      })
      .catch((err) => {
        setRequestState({ type: "error", msg: `${err}` });
      });
  };

  switch (componentState.type) {
    case "error":
      return <div style={{ color: "#f00" }}>{componentState.msg}</div>;
    case "waiting":
      return <div>Loading...</div>;
    case "profile":
      return (
        <>
          <h2>Profile for {componentState.user.display}</h2>
          <div>
            <ul>
              <li>Username: {componentState.user.username}</li>
              <li>
                Account created{" "}
                {componentState.user.createdAt
                  ? timeSince(componentState.user.createdAt)
                  : "hidden until you become friends"}
              </li>
              <li>Stats visibility: {componentState.user.canViewStats ? "visible" : "hidden"}</li>
            </ul>
          </div>
          <div>
            {requestState.type === "sent" ? (
              <p>Friend request sent!</p>
            ) : (
              <button onClick={handleSendRequest} disabled={requestState.type === "sending"}>
                {requestState.type === "sending" ? "Sending" : "Send Friend Request"}
              </button>
            )}

            {requestState.type === "error" && <p style={{ color: "#d00 " }}>{requestState.msg}</p>}
          </div>
        </>
      );
  }
}
