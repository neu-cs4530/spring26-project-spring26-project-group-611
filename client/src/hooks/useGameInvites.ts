import type { ErrorMsg, GameInviteInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useAuth from "./useAuth.ts";
import { getIncomingGameInvites } from "../services/gameInviteService.ts";

/**
 * Custom hook to fetch and manage incoming game invites
 * @returns an object containing either an error message or the list of invites
 */
export default function useGameInvites(): { message: string } | GameInviteInfo[] {
  const auth = useAuth();
  const [invites, setInvites] = useState<GameInviteInfo[] | ErrorMsg | null>(null);

  useEffect(() => {
    getIncomingGameInvites(auth).then(setInvites);
  }, [auth]);

  if (!invites) return { message: "Loading..." };
  if ("error" in invites) return { message: `Error: ${invites.error}` };
  return invites;
}
