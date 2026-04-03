import "./GamePanel.css";
import type { GameInfo } from "@gamenite/shared";
import { useEffect, useMemo, useState } from "react";
import { gameNames } from "../util/consts.ts";
import useLoginContext from "../hooks/useLoginContext.ts";
import GameDispatch from "../games/GameDispatch.tsx";
import useSocketsForGame from "../hooks/useSocketsForGame.ts";
import useTimeSince from "../hooks/useTimeSince.ts";
import UserLink from "./UserLink.tsx";
import { getCurrentFriends } from "../services/friendService.ts";
import { inviteToGame, kickFromGame } from "../services/gameService.ts";

/**
 * A game panel allows viewing the status and players of a live game
 */
export default function GamePanel({
  gameId,
  type,
  players: initialPlayers,
  createdAt,
  minPlayers,
  maxPlayers,
  createdBy,
}: GameInfo) {
  const { user, pass } = useLoginContext();
  const timeSince = useTimeSince();
  const [friendsState, setFriendsState] = useState<
    | { type: "loading" }
    | { type: "error"; message: string }
    | { type: "loaded"; usernames: string[] }
  >({ type: "loading" });
  const [selectedFriend, setSelectedFriend] = useState<string>("");
  const [inviteState, setInviteState] = useState<
    { type: "idle" } | { type: "sending" } | { type: "sent" } | { type: "error"; message: string }
  >({ type: "idle" });
  const [kickError, setKickError] = useState<string | null>(null);

  const isHost = createdBy.username === user.username;

  async function kickPlayer(username: string) {
    setKickError(null);
    const result = await kickFromGame(
      { username: user.username, password: pass },
      { gameId, username },
    );
    if ("error" in result) {
      setKickError(result.error);
    }
  }

  const { view, players, userPlayerIndex, hasWatched, joinGame, startGame } = useSocketsForGame(
    gameId,
    initialPlayers,
  );

  useEffect(() => {
    if (!isHost) return;
    let cancelled = false;

    getCurrentFriends({ username: user.username, password: pass }).then((response) => {
      if (cancelled) return;
      if ("error" in response) {
        setFriendsState({ type: "error", message: response.error });
        return;
      }
      setFriendsState({ type: "loaded", usernames: response.map((friend) => friend.username) });
    });

    return () => {
      cancelled = true;
    };
  }, [isHost, pass, user.username]);

  const playersByUsername = useMemo(
    () => new Set(players.map((player) => player.username)),
    [players],
  );
  const invitableFriends = useMemo(() => {
    if (friendsState.type !== "loaded") return [];
    return friendsState.usernames.filter((username) => !playersByUsername.has(username));
  }, [friendsState, playersByUsername]);

  const effectiveSelectedFriend = useMemo(() => {
    if (invitableFriends.includes(selectedFriend)) return selectedFriend;
    return invitableFriends[0] ?? "";
  }, [invitableFriends, selectedFriend]);

  async function sendInvite(toUsername: string) {
    if (!toUsername) return;
    setInviteState({ type: "sending" });
    const result = await inviteToGame(
      { username: user.username, password: pass },
      { gameId, toUsername },
    );
    if ("error" in result) {
      setInviteState({ type: "error", message: result.error });
      return;
    }
    setInviteState({ type: "sent" });
  }

  return hasWatched ? (
    <div className="gamePanel">
      <div className="gameRoster">
        <h2>{gameNames[type]}</h2>
        <div className="smallAndGray">Game room created {timeSince(createdAt)}</div>
        <div className="smallAndGray">
          {maxPlayers !== null
            ? `Players: ${minPlayers}-${maxPlayers} required`
            : `Players: ${minPlayers}+ required`}
        </div>
        <div className="dottedList" role="list">
          {players.map((player, index) => (
            <div className="dottedListItem" role="listitem" key={player.username}>
              {player.username === user.username ? (
                `you are player #${index + 1}`
              ) : (
                <span>
                  Player #{index + 1} is <UserLink user={player} />
                  {isHost && !view && (
                    <button
                      className="primary narrow"
                      style={{ position: "static", marginLeft: "0.5rem" }}
                      onClick={() => void kickPlayer(player.username)}
                    >
                      Kick
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
        {kickError && <div className="error-message">{kickError}</div>}
        {
          // If the game hasn't started and user hasn't joined, they can join
          userPlayerIndex < 0 && !view && (
            <button className="primary narrow" onClick={joinGame}>
              Join Game
            </button>
          )
        }
        {
          // If the game hasn't started and the user has joined, they can start the game if a minimum number of players are present
          userPlayerIndex >= 0 && !view && players.length >= minPlayers && (
            <button className="primary narrow" onClick={startGame}>
              Start Game
            </button>
          )
        }
        {isHost && !view && (
          <div className="gameInviteBox">
            <div className="gameInviteLabel">Invite a friend</div>
            {friendsState.type === "loading" && (
              <div className="smallAndGray">Loading friends...</div>
            )}
            {friendsState.type === "error" && (
              <div className="error-message">Could not load friends: {friendsState.message}</div>
            )}
            {friendsState.type === "loaded" && (
              <>
                {invitableFriends.length === 0 ? (
                  <div className="smallAndGray">No available friends to invite.</div>
                ) : (
                  <div className="gameInviteControls">
                    <select
                      value={effectiveSelectedFriend}
                      aria-label="Select friend to invite"
                      onChange={(event) => {
                        setSelectedFriend(event.target.value);
                        setInviteState({ type: "idle" });
                      }}
                    >
                      {invitableFriends.map((username) => (
                        <option key={username} value={username}>
                          {username}
                        </option>
                      ))}
                    </select>
                    <button
                      className="primary narrow"
                      onClick={() => void sendInvite(effectiveSelectedFriend)}
                      disabled={!effectiveSelectedFriend || inviteState.type === "sending"}
                    >
                      {inviteState.type === "sending" ? "Inviting..." : "Invite"}
                    </button>
                  </div>
                )}
                {inviteState.type === "sent" && (
                  <div className="smallAndGray">Invite sent to {effectiveSelectedFriend}.</div>
                )}
                {inviteState.type === "error" && (
                  <div className="error-message">{inviteState.message}</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {view ? (
        <div className="gameFrame">
          <GameDispatch
            gameId={gameId}
            userPlayerIndex={userPlayerIndex}
            players={players}
            view={view}
          />
        </div>
      ) : (
        <div className="gameFrame waiting content">waiting for game to begin</div>
      )}
    </div>
  ) : (
    <div></div>
  );
}
