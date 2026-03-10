import "./FriendRequestPanel.css";
import { useEffect, useState } from "react";
import type { IncomingFriendRequestInfo, SafeUserInfo } from "@gamenite/shared";

interface FriendRequestPanelProps {
  incomingRequests: IncomingFriendRequestInfo[];
  currentFriends: SafeUserInfo[];
  handleAcceptFriendRequest: (requestId: string) => Promise<void | { error: string }>;
  handleDeclineFriendRequest: (requestId: string) => Promise<void | { error: string }>;
}

export default function FriendRequestPanel({
  incomingRequests,
  currentFriends,
  handleAcceptFriendRequest,
  handleDeclineFriendRequest,
}: FriendRequestPanelProps) {
  const [requests, setRequests] = useState<IncomingFriendRequestInfo[]>(incomingRequests);
  const [friends, setFriends] = useState<SafeUserInfo[]>(currentFriends);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setRequests(incomingRequests);
  }, [incomingRequests]);

  useEffect(() => {
    setFriends(currentFriends);
  }, [currentFriends]);

  async function onAccept(request: IncomingFriendRequestInfo) {
    const result = await handleAcceptFriendRequest(request.requestId);

    if (result && "error" in result) {
      setError(result.error);
      return;
    }

    setRequests((prev) =>
      prev.filter((existingRequest) => existingRequest.requestId !== request.requestId),
    );

    setFriends((prev) => [...prev, request.fromUser]);
    setError("");
  }

  async function onDecline(requestId: string) {
    const result = await handleDeclineFriendRequest(requestId);

    if (result && "error" in result) {
      setError(result.error);
      return;
    }

    setRequests((prev) =>
      prev.filter((existingRequest) => existingRequest.requestId !== requestId),
    );

    setError("");
  }

  return (
    <div className="friendRequestPanel">
      <section className="friendSection">
        <h2>Incoming Friend Requests</h2>

        {error !== "" && <p>{error}</p>}

        {requests.length === 0 ? (
          <p>No incoming friend requests.</p>
        ) : (
          <ul>
            {requests.map((request) => (
              <li key={request.requestId} className="friendRow">
                <span>
                  {request.fromUser.display} (@{request.fromUser.username})
                </span>
                <div className="friendActions">
                  <button onClick={() => void onAccept(request)}>Accept</button>
                  <button onClick={() => void onDecline(request.requestId)}>Decline</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="friendSection">
        <h2>Current Friends</h2>

        {friends.length === 0 ? (
          <p>You do not have any friends yet.</p>
        ) : (
          <ul>
            {friends.map((friend) => (
              <li key={friend.username} className="friendRow">
                {friend.display} (@{friend.username})
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
