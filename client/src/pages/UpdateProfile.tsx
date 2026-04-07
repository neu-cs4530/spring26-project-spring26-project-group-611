import type { ProfileViewInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useLoginContext from "../hooks/useLoginContext";
import useTimeSince from "../hooks/useTimeSince";
import useEditProfileForm from "../hooks/useEditProfileForm";
import { viewProfile } from "../services/userService";
import { toggleAcceptGameInvites } from "../services/gameInviteService";
import { gameNames } from "../util/consts";
import "./ViewProfile.css";

export default function UpdateProfile() {
  const { user, pass } = useLoginContext();
  const timeSince = useTimeSince();
  const [showPass, setShowPass] = useState(false);
  const [acceptGameInvites, setAcceptGameInvites] = useState(user.acceptGameInvites ?? true);
  const [statsState, setStatsState] = useState<
    | { type: "loading" }
    | { type: "error"; msg: string }
    | { type: "loaded"; profile: ProfileViewInfo }
  >({ type: "loading" });
  const {
    display,
    setDisplay,
    canViewStats,
    setCanViewStats,
    password,
    setPassword,
    confirm,
    setConfirm,
    err,
    handleSubmit,
  } = useEditProfileForm();

  useEffect(() => {
    let canceled = false;
    viewProfile({ username: user.username, password: pass }, user.username)
      .then((response) => {
        if (canceled) return;
        if ("error" in response) {
          setStatsState({ type: "error", msg: response.error });
          return;
        }
        setStatsState({ type: "loaded", profile: response });
      })
      .catch((err) => {
        if (canceled) return;
        setStatsState({ type: "error", msg: `${err}` });
      });
    return () => {
      canceled = true;
    };
  }, [user.username, pass]);
  const handleToggleAcceptGameInvites = async () => {
    try {
      const result = await toggleAcceptGameInvites({
        username: user.username,
        password: pass,
      });

      if ("error" in result) {
        console.error(result.error);
        return;
      }

      setAcceptGameInvites(result.acceptGameInvites);
    } catch (err) {
      console.error(err);
    }
  };

  const renderSelfStats = () => {
    if (statsState.type === "loading") {
      return <div className="smallAndGray">Loading stats...</div>;
    }
    if (statsState.type === "error") {
      return <div className="error-message">{statsState.msg}</div>;
    }
    const { profile } = statsState;
    if (!profile.stats) {
      return <div className="smallAndGray">No stats available yet.</div>;
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

  return (
    <form className="content spacedSection" onSubmit={handleSubmit}>
      <h2>Profile</h2>
      <div>
        <h3>General information</h3>
        <ul>
          <li>Username: {user.username}</li>
          <li>Account created {timeSince(user.createdAt)}</li>
        </ul>
      </div>
      <hr />

      <div className="spacedSection">
        <h3>Game stats</h3>
        {renderSelfStats()}
      </div>
      <hr />

      <div className="spacedSection">
        <h3>Display name</h3>
        <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
          <input
            className="widefill notTooWide"
            value={display}
            onChange={(e) => setDisplay(e.target.value)}
          />
          <button
            className="secondary narrow"
            onClick={(e) => {
              e.preventDefault();
              setDisplay(user.display);
            }}
          >
            Reset
          </button>
        </div>
      </div>
      <hr />

      <div className="spacedSection">
        <h3>Reset password</h3>
        <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
          <input
            type={showPass ? "input" : "password"}
            className="widefill notTooWide"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="secondary narrow"
            onClick={(e) => {
              e.preventDefault();
              setPassword("");
              setConfirm("");
            }}
          >
            Reset
          </button>
          <button
            className="secondary narrow"
            aria-label="Toggle show password"
            onClick={(e) => {
              e.preventDefault();
              setShowPass((v) => !v);
            }}
          >
            {showPass ? "Hide" : "Reveal"}
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
          <input
            type={showPass ? "input" : "password"}
            className="widefill notTooWide"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>
      <hr />

      <div className="spacedSection">
        <h3>Profile visibility</h3>
        <div className="labeled-section">
          <input
            type="checkbox"
            id="canViewStatsToggle"
            checked={canViewStats}
            onChange={() => setCanViewStats((v) => !v)}
          />
          <label htmlFor="canViewStatsToggle">
            Allow non-friends to view my stats and public profile details
          </label>
        </div>
      </div>
      <hr />

      <div className="spacedSection">
        <h3>Game invites</h3>
        <div className="labeled-section">
          <input
            type="checkbox"
            id="acceptGameInvitesToggle"
            checked={acceptGameInvites}
            onChange={handleToggleAcceptGameInvites}
          />
          <label htmlFor="acceptGameInvitesToggle">
            Allow other players to send me game invites
          </label>
        </div>
      </div>
      <hr />

      {err && <p className="error-message">{err}</p>}
      <div>
        <button className="primary narrow">Submit</button>
      </div>
      <div className="smallAndGray">After updating your profile, you will be logged out</div>
    </form>
  );
}
