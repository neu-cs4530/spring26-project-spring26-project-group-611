import type { ProfileViewInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useTimeSince from "../hooks/useTimeSince";
import useLoginContext from "../hooks/useLoginContext";
import { viewProfile } from "../services/userService";
import { sendFriendRequest } from "../services/friendService";
import { gameNames } from "../util/consts";
import "./ViewProfile.css";

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

  const renderStats = (profile: ProfileViewInfo) => {
    if (!profile.canViewStats || !profile.stats) {
      return (
        <div className="smallAndGray">
          Game stats are hidden. Become friends to view this player&apos;s stats;
        </div>
      );
    }

    const winRatePercent = `${Math.round(profile.stats.overallWinRate * 100)}%`;

    return (
      <div className="view-profile__stats spacedSection">
        <div className="view-profile__stats-summary">
          <div>
            <strong>Overall win rate:</strong>
            {winRatePercent}
          </div>
          <div>
            <strong>Favorite game:</strong>{" "}
            {profile.stats.favoriteGame
              ? gameNames[profile.stats.favoriteGame]
              : "No games played yet"}
          </div>
        </div>

        <h3>Recent games</h3>
        {profile.stats.games.length === 0 ? (
          <div className="smallAndGray">No finished games yet.</div>
        ) : (
          <ul className="view-profile__stats-list">
            {profile.stats.games.map((game) => (
              <li key={game.gameId} className="view-profile__stats-item">
                <div className="view-profile__stats-main">
                  <span className="view-profile__game-name">{gameNames[game.type]}</span>
                  <span className="smallAndGray">played {timeSince(game.playedAt)}</span>
                </div>
                <div className="view-profile_stats-meta">
                  <span
                    className={
                      game.didWin ? "view-profile__result-win" : "view-profile__result-loss"
                    }
                  >
                    {game.didWin ? "win " : "loss "}
                  </span>
                  <span className="smallAndGray">
                    {game.didWin ? "win " : "loss "} streak: {game.streak}{" "}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };
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
        <div className="content spacedSection">
          <h2>Profile for {componentState.user.display}</h2>
          <div className="spacedSection">
            <h3>General information</h3>
            <ul>
              <li>Username: {componentState.user.username}</li>
              <li>
                Account created{" "}
                {componentState.user.createdAt
                  ? timeSince(componentState.user.createdAt)
                  : "hidden until you become friends"}
              </li>
            </ul>
          </div>
          <div className="spacedSection">
            <h3>Game Stats</h3>
            {renderStats(componentState.user)}
          </div>

          <div className="spacedSection">
            {requestState.type === "sent" ? (
              <p className="smallAndGray">Friend request sent!</p>
            ) : (
              <button
                className="primary narrow"
                onClick={handleSendRequest}
                disabled={requestState.type === "sending"}
              >
                {requestState.type === "sending" ? "Sending" : "Send Friend Request"}
              </button>
            )}

            {requestState.type === "error" && <p className="error-message">{requestState.msg}</p>}
          </div>
        </div>
      );
  }
}
