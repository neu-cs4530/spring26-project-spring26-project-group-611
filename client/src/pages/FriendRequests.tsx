import type { FriendRequestInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useLoginContext from "../hooks/useLoginContext";
import useTimeSince from "../hooks/useTimeSince";
import { getIncomingFriendRequests } from "../services/friendService";
import "./FriendRequests.css";

export default function FriendRequests() {
  const { user, pass } = useLoginContext();
  const timeSince = useTimeSince();
  const [state, setState] = useState<
    | { type: "loading" }
    | { type: "error"; msg: string }
    | { type: "loaded"; requests: FriendRequestInfo[] }
  >({ type: "loading" });
  useEffect(() => {
    let cancelled = false;

    getIncomingFriendRequests({ username: user.username, password: pass })
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          setState({ type: "error", msg: res.error });
        } else {
          setState({ type: "loaded", requests: res });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ type: "error", msg: `${err}` });
      });

    return () => {
      cancelled = true;
    };
  }, [user.username, pass]);

  if (state.type === "loading") {
    return <div className="friend-requests">Loading friend requests...</div>;
  }
  if (state.type === "error") {
    return <div className="friend-requests friend-requests__error">{state.msg}</div>;
  }
  if (state.requests.length === 0) {
    return (
      <div className="friend-requests">
        <h2>Incoming Friend Requests</h2>
        <p className="friend-requests__empty"> No pending friend requests.</p>
      </div>
    );
  }

  return (
    <div className="friend-requests">
      <h2>Incoming Friend Requests</h2>
      <ul className="friend-requests__list">
        {state.requests.map((req) => (
          <li key={req.id} className="friend-requests__item">
            <span className="friend-requests__from">{req.fromUsername}</span>
            <span className="friend-requests__time">
              {" "}
              sent a request {timeSince(new Date(req.createdAt))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
