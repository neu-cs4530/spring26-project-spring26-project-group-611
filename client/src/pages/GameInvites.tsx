import type { GameInviteInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import { gameNames } from "../util/consts.ts";
import useTimeSince from "../hooks/useTimeSince.ts";
import {
  acceptGameInvite,
  declineGameInvite,
  getIncomingGameInvites,
} from "../services/gameInviteService.ts";
import { getGameById } from "../services/gameService.ts";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.ts";
import useLoginContext from "../hooks/useLoginContext.ts";
import "./GameInvites.css";

type InviteWithGame = GameInviteInfo & {
  game: {
    gameId: string;
    type: "nim" | "guess";
    status: "waiting" | "active" | "done";
    createdAt: Date;
    createdBy: { username: string; display: string; createdAt: Date };
    players: { username: string; display: string; createdAt: Date }[];
  } | null;
};

export default function GameInvites() {
  const auth = useAuth();
  const { socket } = useLoginContext();
  const timeSince = useTimeSince();
  const navigate = useNavigate();

  const [state, setState] = useState<
    | { type: "loading" }
    | { type: "error"; msg: string }
    | { type: "loaded"; invites: InviteWithGame[] }
  >({ type: "loading" });

  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadInvites = () => {
      getIncomingGameInvites(auth)
        .then(async (result) => {
          if (cancelled) return;

          if ("error" in result) {
            setState({ type: "error", msg: result.error });
            return;
          }

          const invitesWithGames = await Promise.all(
            result.map(async (invite) => {
              const gameInfo = await getGameById(invite.gameId);
              return {
                ...invite,
                game: "error" in gameInfo ? null : gameInfo,
              };
            }),
          );

          if (cancelled) return;
          setState({ type: "loaded", invites: invitesWithGames });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setState({
            type: "error",
            msg: err instanceof Error ? err.message : "Could not load game invites",
          });
        });
    };

    const handleInvitesUpdated = () => {
      loadInvites();
    };

    socket.emit("gameInviteJoin", { auth, payload: {} });
    socket.on("gameInvitesUpdated", handleInvitesUpdated);

    loadInvites();

    return () => {
      cancelled = true;
      socket.off("gameInvitesUpdated", handleInvitesUpdated);
      socket.emit("gameInviteLeave", { auth, payload: {} });
    };
  }, [socket, auth]);

  function formatStatus(status: "waiting" | "active" | "done" | undefined) {
    if (!status) return "Unknown";
    return status[0].toUpperCase() + status.slice(1);
  }

  function inviterName(invite: InviteWithGame) {
    const display = invite.game?.createdBy.display?.trim();
    return display ? display : invite.fromUsername;
  }

  const handleAccept = async (invite: GameInviteInfo) => {
    setPendingInviteId(invite.inviteId);
    const result = await acceptGameInvite(auth, invite.inviteId);

    if ("error" in result) {
      setPendingInviteId(null);
      setState({ type: "error", msg: result.error });
      return;
    }

    setPendingInviteId(null);
    setState((current) => {
      if (current.type !== "loaded") return current;
      return {
        type: "loaded",
        invites: current.invites.filter((inv) => inv.inviteId !== invite.inviteId),
      };
    });

    navigate(`/game/${invite.gameId}`);
  };

  const handleDecline = async (invite: GameInviteInfo) => {
    setPendingInviteId(invite.inviteId);
    const result = await declineGameInvite(auth, invite.inviteId);

    if ("error" in result) {
      setPendingInviteId(null);
      setState({ type: "error", msg: result.error });
      return;
    }

    setPendingInviteId(null);
    setState((current) => {
      if (current.type !== "loaded") return current;
      return {
        type: "loaded",
        invites: current.invites.filter((inv) => inv.inviteId !== invite.inviteId),
      };
    });
  };

  if (state.type === "loading") {
    return <div className="game-invites">Loading game invites...</div>;
  }

  if (state.type === "error") {
    return <div className="game-invites game-invites__error">{state.msg}</div>;
  }

  return (
    <div className="game-invites">
      <section>
        <h2>Game Invitations</h2>
        {state.invites.length === 0 ? (
          <p className="game-invites__empty">No pending game invitations.</p>
        ) : (
          <ul className="game-invites__cards">
            {state.invites.map((invite) => (
              <li key={invite.inviteId} className="game-invites__card">
                <div className="game-invites__header">
                  <div className="game-invites__title">
                    {invite.game ? gameNames[invite.game.type] : "Unknown game"}
                  </div>
                  <div className="game-invites__status">{formatStatus(invite.game?.status)}</div>
                </div>

                <div className="game-invites__divider" />

                <div className="game-invites__meta">
                  <span className="game-invites__fromTag">invited!</span>
                  <span>
                    <strong>{inviterName(invite)}</strong> invited you{" "}
                    {timeSince(new Date(invite.createdAt))}
                  </span>
                </div>

                {invite.game ? (
                  <>
                    <div className="game-invites__subtle">
                      Created by {inviterName(invite)} • {invite.game.players.length} player
                      {invite.game.players.length === 1 ? "" : "s"}
                    </div>
                    <div className="game-invites__players">
                      {invite.game.players.map((player, idx) => (
                        <div key={player.username} className="game-invites__playerRow">
                          Player #{idx + 1}: {player.display}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="game-invites__subtle">Could not load game details.</div>
                )}

                <div className="game-invites__actions">
                  <button
                    className="primary narrow"
                    onClick={() => void handleAccept(invite)}
                    disabled={pendingInviteId === invite.inviteId}
                  >
                    {pendingInviteId === invite.inviteId ? "Accepting..." : "Accept"}
                  </button>

                  <button
                    className="secondary narrow"
                    onClick={() => void handleDecline(invite)}
                    disabled={pendingInviteId === invite.inviteId}
                  >
                    {pendingInviteId === invite.inviteId ? "Declining..." : "Decline"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
