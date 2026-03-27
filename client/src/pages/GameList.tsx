import { useNavigate } from "react-router-dom";
import GameSummaryView from "../components/GameSummaryView.tsx";
import useGameListWithInvites from "../hooks/useGameListWithInvites.ts";

export default function GameList() {
  const gameList = useGameListWithInvites();
  const navigate = useNavigate();

  return (
    <div className="content">
      <div className="spacedSection">
        <h2>All games</h2>
        <div>
          <button className="primary narrow" onClick={() => navigate("/game/new")}>
            Create New Game
          </button>
        </div>
        <>
          {"message" in gameList ? (
            gameList.message
          ) : (
            <div className="dottedList">
              {gameList.map((game) => (
                <GameSummaryView {...game} key={game.gameId.toString()} />
              ))}
            </div>
          )}
        </>
      </div>
    </div>
  );
}
