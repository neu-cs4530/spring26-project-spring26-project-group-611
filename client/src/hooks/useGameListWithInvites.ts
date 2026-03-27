import type { ErrorMsg, GameInfo, GameInviteInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useAuth from "./useAuth.ts";
import useLoginContext from "./useLoginContext.ts";
import { gameList } from "../services/gameService.ts";
import { getIncomingGameInvites } from "../services/gameInviteService.ts";

export type GameWithInviteStatus = GameInfo & {
  inviteStatus?: "invited";
  fromUsername?: string;
};

/**
 * Custom hook to get the list of games with invite status information
 * @param maxGames - the maximum number of games desired (default is all of them)
 * @returns A message to display to the user, or a list of games with invite status
 */
export default function useGameListWithInvites(
  maxGames?: number,
): { message: string } | GameWithInviteStatus[] {
  const auth = useAuth();
  const { socket } = useLoginContext();
  const [games, setGames] = useState<GameWithInviteStatus[] | ErrorMsg | null>(null);

  useEffect(() => {
    function refreshGamesWithInvites() {
      Promise.all([gameList(), getIncomingGameInvites(auth)]).then(([gamesRes, invitesRes]) => {
        if ("error" in gamesRes) {
          setGames(gamesRes);
          return;
        }

        // If invites fetch failed, just use games without invite info
        const invites = "error" in invitesRes ? [] : invitesRes;

        // Create a map of gameId -> invite info for quick lookup
        const inviteMap = new Map<string, GameInviteInfo>();
        invites.forEach((invite) => {
          if (invite.status === "pending") {
            inviteMap.set(invite.gameId, invite);
          }
        });

        // Enrich games with invite status
        const enrichedGames = gamesRes.map((game) => {
          const invite = inviteMap.get(game.gameId);
          if (invite) {
            return {
              ...game,
              inviteStatus: "invited" as const,
              fromUsername: invite.fromUsername,
            };
          }
          return game;
        });

        if (maxGames) {
          setGames(enrichedGames.slice(0, maxGames));
        } else {
          setGames(enrichedGames);
        }
      });
    }

    const handleGameCreated = () => {
      refreshGamesWithInvites();
    };

    refreshGamesWithInvites();
    socket.on("gameCreated", handleGameCreated);

    return () => {
      socket.off("gameCreated", handleGameCreated);
    };
  }, [auth, maxGames, socket]);

  if (!games) return { message: "Loading..." };
  if ("error" in games) return { message: `Error: ${games.error}` };
  if (games.length === 0) return { message: "No games found..." };
  return games;
}
