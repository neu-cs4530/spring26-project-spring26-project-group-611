import type { ErrorMsg, GameInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import { gameList } from "../services/gameService.ts";
import useLoginContext from "./useLoginContext.ts";

/**
 * Custom hook to get the list of all thread summaries and decide on an
 * appropriate message if that list is not available.
 * @param maxSummaries - the maximum number of summaries desired (default is all of them)
 * @returns A message to display to the user (Loading... or an error message), or a list
 */
export default function useGameList(maxGames?: number): { message: string } | GameInfo[] {
  const { socket } = useLoginContext();
  const [games, setGames] = useState<GameInfo[] | ErrorMsg | null>(null);

  useEffect(() => {
    function refreshGames() {
      gameList().then(setGames);
    }

    const handleGameCreated = () => {
      refreshGames();
    };

    refreshGames();
    socket.on("gameCreated", handleGameCreated);

    return () => {
      socket.off("gameCreated", handleGameCreated);
    };
  }, [socket]);

  if (!games) return { message: "Loading..." };
  if ("error" in games) return { message: `Error: ${games.error}` };
  if (games.length === 0) return { message: "No games found..." };
  if (maxGames) return games.slice(0, maxGames);
  return games;
}
