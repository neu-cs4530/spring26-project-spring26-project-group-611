import "./FriendRequestPanel.css";
import { useEffect, useState } from "react";
import type { FriendRequestInfo, SafeUserInfo } from "@gamenite/shared";

interface FriendRequestPanelProps {
  incomingRequests: FriendRequestInfo[];
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
  const [requests, setRequests] = useState<FriendRequestInfo[]>(incomingRequests);
  const [friends, setFriends] = useState<SafeUserInfo[]>(currentFriends);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    setRequests(incomingRequests);
  }, [incomingRequests]);

  useEffect(() => {
    setFriends(currentFriends);
  }, [currentFriends]);

  async function onAccept(request: FriendRequestInfo) {
    const result = await handleAcceptFriendRequest(request.id);

    if (result && "error" in result) {
      setError(result.error);
      return;
    }

    setRequests((prev) => prev.filter((existingRequest) => existingRequest.id !== request.id));

    setFriends((prev) => [
      ...prev,
      {
        username: request.fromUsername,
        display: request.fromDisplay,
        createdAt: new Date(),
      },
    ]);
    setError("");
  }

  async function onDecline(requestId: string) {
    const result = await handleDeclineFriendRequest(requestId);

    if (result && "error" in result) {
      setError(result.error);
      return;
    }

    setRequests((prev) => prev.filter((existingRequest) => existingRequest.id !== requestId));

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
              <li key={request.id} className="friendRow">
                <span>
                  {request.fromDisplay} (@{request.fromUsername})
                </span>
                <div className="friendActions">
                  <button onClick={() => void onAccept(request)}>Accept</button>
                  <button onClick={() => void onDecline(request.id)}>Decline</button>
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
