import { useState } from "react";
import useNewGameForm from "../hooks/useNewGameForm.ts";
import { gameNames } from "../util/consts.ts";

export default function NewGame() {
  const { gameKey, handleInputChange, err, handleSubmit } = useNewGameForm();
  const [visibility, setVisibility] = useState<"public" | "private">("public");

  return (
    <form className="content spacedSection" onSubmit={(e) => handleSubmit(e, visibility)}>
      <h2>Create new game</h2>
      <div>
        <select value={gameKey} aria-label="Game selection" onChange={(e) => handleInputChange(e)}>
          <option value="">— Select a game —</option>
          {Object.entries(gameNames).map(([key, name]) => (
            <option key={key} value={key}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-visibility">
        <label htmlFor="visibility-select">Visibility: </label>
        <select
          id="visibility-select"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as "public" | "private")}
        >
          <option value="public">Public</option>
          <option value="private">Private</option>
        </select>
        <p className="note">
          {visibility === "public"
            ? "Anyone can join this game."
            : "Only invited friends can join."}
        </p>
      </div>
      {err && <p className="error-message">{err}</p>}
      <div>
        <button className="primary narrow">Create New Game</button>
      </div>
    </form>
  );
}
