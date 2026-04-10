import "./SideBarNav.css";
import { useEffect, useState } from "react";
import { NavLink, type NavLinkRenderProps, useLocation } from "react-router-dom";
import useAuth from "../hooks/useAuth.ts";
import { getIncomingGameInvites } from "../services/gameInviteService.ts";
import { getIncomingFriendRequests } from "../services/friendService.ts";
import useLoginContext from "../hooks/useLoginContext.ts";

/**
 * The SideBarNav component contains the primary naviagation menu. It
 * highlights the currently selected page and triggers navigation when the
 * menu items are clicked.
 */
export default function SideBarNav() {
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const { socket } = useLoginContext();
  const auth = useAuth();
  const { username } = auth;
  const location = useLocation();
  const [pendingInvites, setPendingInvites] = useState<number>(0);
  const [pendingFriendRequests, setPendingFriendRequests] = useState<number>(0);

  const toggleOptions = () => {
    setShowOptions(!showOptions);
  };

  const navClass = ({ isActive }: NavLinkRenderProps) =>
    `menu_button ${isActive ? "menu_selected" : ""}`;
  const displayPendingFriendRequests =
    location.pathname === "/friends/requests" ? 0 : pendingFriendRequests;

  useEffect(() => {
    let cancelled = false;

    async function refreshInvites() {
      const result = await getIncomingGameInvites(auth);
      if (cancelled) return;
      if ("error" in result) {
        setPendingInvites(0);
        return;
      }
      setPendingInvites(result.length);
    }

    const handleInvitesUpdated = () => {
      void refreshInvites();
    };

    socket.emit("gameInviteJoin", { auth, payload: {} });
    socket.on("gameInvitesUpdated", handleInvitesUpdated);
    void refreshInvites();

    return () => {
      cancelled = true;
      socket.off("gameInvitesUpdated", handleInvitesUpdated);
      socket.emit("gameInviteLeave", { auth, payload: {} });
    };
  }, [auth, socket]);

  useEffect(() => {
    let cancelled = false;

    async function refreshFriendRequests() {
      const result = await getIncomingFriendRequests(auth);
      if (cancelled) return;
      if ("error" in result) {
        setPendingFriendRequests(0);
        return;
      }
      setPendingFriendRequests(result.length);
    }

    void refreshFriendRequests();
    const intervalId = window.setInterval(() => {
      void refreshFriendRequests();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [auth]);

  useEffect(() => {
    const onFriendRequestReceived = () => {
      setPendingFriendRequests((current) => current + 1);
    };

    socket.on("friendRequestReceived", onFriendRequestReceived);
    return () => {
      socket.off("friendRequestReceived", onFriendRequestReceived);
    };
  }, [socket]);

  return (
    <div className="sideBarNav">
      <NavLink to="/" className={navClass}>
        Home
      </NavLink>
      <NavLink to="/games" className={navClass}>
        Games
      </NavLink>
      <NavLink to="/games/invites" className={navClass}>
        Game Invites
        {pendingInvites > 0 && <span className="menu_badge">{pendingInvites}</span>}
      </NavLink>
      <NavLink to="/forum" className={navClass}>
        Forum
      </NavLink>
      <NavLink
        to="/friends/requests"
        className={navClass}
        onClick={() => setPendingFriendRequests(0)}
      >
        Friends
        {displayPendingFriendRequests > 0 && (
          <span className="menu_badge">{displayPendingFriendRequests}</span>
        )}
      </NavLink>
      <NavLink
        to={`/profile/${username}`}
        id="menu_user"
        className={navClass}
        onClick={toggleOptions}
      >
        Profile
      </NavLink>
    </div>
  );
}
