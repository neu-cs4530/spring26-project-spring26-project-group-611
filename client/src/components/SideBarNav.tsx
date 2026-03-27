import "./SideBarNav.css";
import { useEffect, useState } from "react";
import { NavLink, type NavLinkRenderProps } from "react-router-dom";
import useAuth from "../hooks/useAuth.ts";
import { getIncomingGameInvites } from "../services/gameInviteService.ts";

/**
 * The SideBarNav component contains the primary naviagation menu. It
 * highlights the currently selected page and triggers navigation when the
 * menu items are clicked.
 */
export default function SideBarNav() {
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const auth = useAuth();
  const { username } = auth;
  const [pendingInvites, setPendingInvites] = useState<number>(0);

  const toggleOptions = () => {
    setShowOptions(!showOptions);
  };

  const navClass = ({ isActive }: NavLinkRenderProps) =>
    `menu_button ${isActive ? "menu_selected" : ""}`;

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

    void refreshInvites();
    const intervalId = window.setInterval(() => {
      void refreshInvites();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [auth]);

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
      <NavLink to="/friends/requests" className={navClass}>
        Friends
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
