import "./GameSummaryView.css";
import type { GameInfo } from "@gamenite/shared";
import { NavLink, useNavigate } from "react-router-dom";
import { gameNames } from "../util/consts.ts";
import useTimeSince from "../hooks/useTimeSince.ts";
import UserLink from "./UserLink.tsx";

/**
 * Summarizes information for a single game as part of a list of games
 */
export default function GameSummaryView({
  gameId,
  status,
  type,
  players,
  createdAt,
  createdBy,
  minPlayers,
  maxPlayers,
  visibility,
  inviteStatus,
}: GameInfo & { inviteStatus?: "invited" }) {
  const timeSince = useTimeSince();
  const navigate = useNavigate();
  const numPlayers = players.length;
  const playerRange = maxPlayers !== null ? `${minPlayers}-${maxPlayers}` : `${minPlayers}+`;
  return (
    <div className="gameSummary" role="listitem">
      <div className="stats" onClick={() => navigate(`/game/${gameId}`)}>
        {status}
        {status !== "done" && `, ${numPlayers}/${playerRange} player${numPlayers === 1 ? "" : "s"}`}
      </div>
      <NavLink to={`/game/${gameId}`} className="mid">
        A game of {gameNames[type]}
      </NavLink>
      <div className="lastActivity">
        {inviteStatus === "invited" && <span className="gameSummary__invited-badge">invited</span>}
        <span
          className={`gameSummary__visibility-badge gameSummary__visibility-badge--${visibility}`}
        >
          {visibility}
        </span>
        <UserLink user={createdBy} capitalize /> created {timeSince(createdAt)}
      </div>
    </div>
  );
}
