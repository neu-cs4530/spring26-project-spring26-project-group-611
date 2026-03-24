import type { GameKey, ProfilePlayedGameStat, ProfileStatsInfo } from "@gamenite/shared";
import { GameRepo } from "../repository.ts";
import type { GameRecord, RecordId } from "../models.ts";

export async function getProfileStats(userId: RecordId): Promise<ProfileStatsInfo> {
  const gameIds = await GameRepo.getAllKeys();

  const allGames: Array<{ gameId: string; game: GameRecord } | null> = await Promise.all(
    gameIds.map(async (gameId) => {
      const game = await GameRepo.get(gameId);
      return game ? { gameId, game } : null;
    }),
  );

  const existingGames: Array<{ gameId: string; game: GameRecord }> = allGames.filter(
    (entry): entry is { gameId: string; game: GameRecord } => entry !== null,
  );

  const finishedGames = existingGames
    .filter(({ game }) => game.done)
    .filter(({ game }) => game.players.includes(userId))
    .filter(({ game }) => game.finishedAt && game.winnerUserIds)
    .sort(
      (a, b) => new Date(b.game.finishedAt!).getTime() - new Date(a.game.finishedAt!).getTime(),
    );

  let runningStreak = 0;
  let lastResult: boolean | null = null;

  const games: ProfilePlayedGameStat[] = finishedGames.map(({ gameId, game }) => {
    const didWin = (game.winnerUserIds ?? []).includes(userId);

    if (lastResult === didWin) {
      runningStreak += 1;
    } else {
      runningStreak = 1;
      lastResult = didWin;
    }

    return {
      gameId,
      type: game.type,
      playedAt: new Date(game.finishedAt!),
      didWin,
      streak: runningStreak,
    };
  });

  const winCount = games.filter((g) => g.didWin).length;
  const totalCount = games.length;

  const countsByGame = new Map<GameKey, number>();
  for (const game of games) {
    countsByGame.set(game.type, (countsByGame.get(game.type) ?? 0) + 1);
  }

  let favoriteGame: GameKey | null = null;
  let favoriteCount = -1;

  for (const [gameType, count] of countsByGame.entries()) {
    if (count > favoriteCount) {
      favoriteGame = gameType;
      favoriteCount = count;
    }
  }

  return {
    games,
    favoriteGame,
    overallWinRate: totalCount === 0 ? 0 : winCount / totalCount,
  };
}
