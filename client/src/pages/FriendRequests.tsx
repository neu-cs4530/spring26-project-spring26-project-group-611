import type { ErrorMsg, FriendRequestInfo, SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useLoginContext from "../hooks/useLoginContext";
import useTimeSince from "../hooks/useTimeSince";
import {
  acceptFriendRequest,
  declineFriendRequest,
  getCurrentFriends,
  getIncomingFriendRequests,
  sendFriendRequest,
  getOutgoingFriendRequests,
} from "../services/friendService";
import { searchUsers } from "../services/userService";
import "./FriendRequests.css";

export default function FriendRequests() {
  const { user, pass } = useLoginContext();
  const timeSince = useTimeSince();
  const [state, setState] = useState<
    | { type: "loading" }
    | { type: "error"; msg: string }
    | {
        type: "loaded";
        requests: FriendRequestInfo[];
        outgoing: FriendRequestInfo[];
        friends: SafeUserInfo[];
      }
  >({ type: "loading" });
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SafeUserInfo[]>([]);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getIncomingFriendRequests({ username: user.username, password: pass }),
      getCurrentFriends({ username: user.username, password: pass }),
      getOutgoingFriendRequests({ username: user.username, password: pass }),
    ])
      .then(([requestsRes, friendsRes, outgoingRes]) => {
        if (cancelled) return;
        if ("error" in requestsRes) {
          setState({ type: "error", msg: requestsRes.error });
          return;
        }
        if ("error" in friendsRes) {
          setState({ type: "error", msg: friendsRes.error });
          return;
        }
        if ("error" in outgoingRes) {
          setState({ type: "error", msg: outgoingRes.error });
          return;
        }
        setState({
          type: "loaded",
          requests: requestsRes,
          friends: friendsRes,
          outgoing: outgoingRes,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ type: "error", msg: `${err}` });
      });

    return () => {
      cancelled = true;
    };
  }, [user.username, pass]);

  const handleSearch = async () => {
    const trimmed = searchTerm.trim();

    if (!trimmed) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    setSearching(true);
    setSearchError("");

    const result = await searchUsers(trimmed);
    setSearching(false);

    if ("error" in result) {
      setSearchError(result.error);
      setSearchResults([]);
      return;
    }

    const filteredResults: SafeUserInfo[] = result.filter(
      (foundUser: SafeUserInfo) => foundUser.username !== user.username,
    );

    setSearchResults(filteredResults);
  };

  const handleSendFriendRequest = async (toUsername: string): Promise<void | ErrorMsg> => {
    setSendingTo(toUsername);

    const result = await sendFriendRequest({ username: user.username, password: pass }, toUsername);

    setSendingTo(null);

    if ("error" in result) {
      setSearchError(result.error);
      return result;
    }

    setSearchError("");
    setState((current) => {
      if (current.type !== "loaded") return current;

      return {
        ...current,
        outgoing: [...current.outgoing, result],
      };
    });
    return;
  };

  const handleAccept = async (request: FriendRequestInfo) => {
    setPendingRequestId(request.id);
    const result = await acceptFriendRequest(
      { username: user.username, password: pass },
      request.id,
    );

    if ("error" in result) {
      setPendingRequestId(null);
      setState({ type: "error", msg: result.error });
      return;
    }

    const friendsRes = await getCurrentFriends({ username: user.username, password: pass });
    setPendingRequestId(null);

    if ("error" in friendsRes) {
      setState({ type: "error", msg: friendsRes.error });
      return;
    }

    setState((current) => {
      if (current.type !== "loaded") return current;
      return {
        type: "loaded",
        requests: current.requests.filter((existing) => existing.id !== request.id),
        outgoing: current.outgoing,
        friends: friendsRes,
      };
    });
  };

  const handleDecline = async (request: FriendRequestInfo) => {
    setPendingRequestId(request.id);
    const result = await declineFriendRequest(
      { username: user.username, password: pass },
      request.id,
    );

    if ("error" in result) {
      setPendingRequestId(null);
      setState({ type: "error", msg: result.error });
      return;
    }

    setPendingRequestId(null);

    setState((current) => {
      if (current.type !== "loaded") return current;
      return {
        ...current,
        requests: current.requests.filter((existing) => existing.id !== request.id),
      };
    });
  };

  if (state.type === "loading") {
    return <div className="friend-requests">Loading friend requests...</div>;
  }

  if (state.type === "error") {
    return <div className="friend-requests friend-requests__error">{state.msg}</div>;
  }

  return (
    <div className="friend-requests">
      <section>
        <h2>Search Users</h2>
        <div className="friend-requests__search">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleSearch();
              }
            }}
            placeholder="Search by username"
          />
          <button onClick={() => void handleSearch()} disabled={searching}>
            {searching ? "Searching..." : "Search"}
          </button>
        </div>

        {searchError && <p className="friend-requests__error">{searchError}</p>}

        {!searching && searchTerm.trim() !== "" && searchResults.length === 0 && !searchError && (
          <p className="friend-requests__empty">No users found.</p>
        )}

        {searchResults.length > 0 && (
          <ul className="friend-requests__list">
            {searchResults.map((foundUser: SafeUserInfo) => (
              <li key={foundUser.username} className="friend-requests__item">
                <div className="friend-requests__details">
                  <span className="friend-requests__from">{foundUser.display}</span>
                  <span className="friend-requests__handle">@{foundUser.username}</span>
                </div>
                <div className="friend-requests__actions">
                  <button
                    className="primary narrow"
                    onClick={() => void handleSendFriendRequest(foundUser.username)}
                    disabled={sendingTo === foundUser.username}
                  >
                    {sendingTo === foundUser.username ? "Sending..." : "Add Friend"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Pending Friend Requests</h2>

        {state.outgoing.length === 0 ? (
          <p className="friend-requests__empty">No pending requests.</p>
        ) : (
          <ul className="friend-requests__list">
            {state.outgoing.map((req) => (
              <li key={req.id} className="friend-requests__item">
                <div className="friend-requests__details">
                  <span className="friend-requests__from">@{req.toUsername}</span>
                  <span className="friend-requests__time">
                    request sent {timeSince(new Date(req.createdAt))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Incoming Friend Requests</h2>
        {state.requests.length === 0 ? (
          <p className="friend-requests__empty">No pending friend requests.</p>
        ) : (
          <ul className="friend-requests__list">
            {state.requests.map((req) => (
              <li key={req.id} className="friend-requests__item">
                <div className="friend-requests__details">
                  <span className="friend-requests__from">{req.fromDisplay}</span>
                  <span className="friend-requests__time">
                    sent a request {timeSince(new Date(req.createdAt))}
                  </span>
                </div>
                <div className="friend-requests__actions">
                  <button
                    className="primary narrow"
                    onClick={() => void handleAccept(req)}
                    disabled={pendingRequestId === req.id}
                  >
                    {pendingRequestId === req.id ? "Accepting..." : "Accept"}
                  </button>

                  <button
                    className="secondary narrow"
                    onClick={() => void handleDecline(req)}
                    disabled={pendingRequestId === req.id}
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="friend-requests__friends-section">
        <h2>Friends List</h2>
        {state.friends.length === 0 ? (
          <p className="friend-requests__empty">You do not have any friends yet.</p>
        ) : (
          <ul className="friend-requests__friends-list">
            {state.friends.map((friend) => (
              <li key={friend.username} className="friend-requests__friend-item">
                <span className="friend-requests__from">{friend.display}</span>
                <span className="friend-requests__handle">@{friend.username}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
