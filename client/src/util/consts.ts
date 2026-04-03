import { type GameKey } from "@gamenite/shared";

export const gameNames: { [key in GameKey]: string } = {
  nim: "Nim",
  guess: "Number Guesser",
};

export function getPlayerRequirements(key: GameKey): { min: number; max: number | null } {
  switch (key) {
    case "nim":
      return { min: 2, max: 2 };
    case "guess":
      return { min: 2, max: null };
  }
}
