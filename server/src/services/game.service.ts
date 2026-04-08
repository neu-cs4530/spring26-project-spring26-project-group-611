import { type GameInfo, type GameKey, type TaggedGameView } from "@gamenite/shared";
import { createChat } from "./chat.service.ts";
import { populateSafeUserInfo } from "./user.service.ts";
import { getUserByUsername } from "./auth.service.ts";
import { type GameServicer } from "../games/gameServiceManager.ts";
import { nimGameService } from "../games/nim.ts";
import { guessGameService } from "../games/guess.ts";
import { type GameViewUpdates, type UserWithId } from "../types.ts";
import { GameRepo, UserRepo } from "../repository.ts";

/**
 * The service interface for individual games
 */
export const gameServices: { [key in GameKey]: GameServicer } = {
  nim: nimGameService,
  guess: guessGameService,
};

/**
 * Expand a stored game
 *
 * @param gameId - Valid game id
 * @returns the expanded game info object
 */
async function populateGameInfo(gameId: string): Promise<GameInfo> {
  const game = await GameRepo.get(gameId);
  return {
    gameId,
    createdBy: await populateSafeUserInfo(game.createdBy),
    chat: game.chat,
    createdAt: new Date(game.createdAt),
    players: await Promise.all(game.players.map(populateSafeUserInfo)),
    type: game.type,
    status: !game.state ? "waiting" : game.done ? "done" : "active",
    minPlayers: gameServices[game.type].minPlayers,
    maxPlayers: gameServices[game.type].maxPlayers,
    visibility: game.visibility ?? "public",
  };
}

/**
 * Create and store a new game
 *
 * @param user - Initial player in the game's waiting room
 * @param type - Game key
 * @param createdAt - Creation time for this game
 * @param visibility - whether the game is private (default: public)
 * @returns the new game's info object
 */
export async function createGame(
  user: UserWithId,
  type: GameKey,
  createdAt: Date,
  visibility?: "public" | "private",
): Promise<GameInfo> {
  const chat = await createChat(createdAt);
  const gameId = await GameRepo.add({
    type,
    done: false,
    chat: chat.chatId,
    createdAt: createdAt.toISOString(),
    createdBy: user.userId,
    players: [user.userId],
    visibility: visibility,
  });
  return populateGameInfo(gameId);
}

/**
 * Retrieves a single game from the database. If you expect the id to be valid, use `forceGameById`.
 *
 * @param gameId - Ostensible game id
 * @returns the game's info object, or null
 */
export async function getGameById(gameId: string): Promise<GameInfo | null> {
  const game = await GameRepo.find(gameId);
  if (!game) return null;
  return populateGameInfo(gameId);
}

/**
 * Adds a user to a game that hasn't started yet. If the resulting game object has the maximum
 * allowed number of players, it is the responsibility of the caller to start the game.
 *
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @returns the game's info object, with the `user` listed among the players
 * @throws if the game id is not valid, if the game has started, or if the game cannot accept more
 * players
 */
export async function joinGame(gameId: string, user: UserWithId): Promise<GameInfo> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} joining invalid game`);
  if (game.visibility === "private") {
    const invited = game.invitees ?? [];

    if (!invited.includes(user.userId) && user.userId !== game.createdBy) {
      throw new Error(`You are not invited to this private game`);
    }
  }
  if (game.state) {
    throw new Error(`user ${user.username} joining game that started`);
  }
  if (game.players.some((userId) => userId === user.userId)) {
    throw new Error(`user ${user.username} joining game they are in already`);
  }
  if (game.players.length === gameServices[game.type].maxPlayers) {
    throw new Error(`user ${user.username} joining full`);
  }

  game.players = [...game.players, user.userId];
  await GameRepo.set(gameId, game);

  return populateGameInfo(gameId);
}

/**
 * Add a host invitation for a user to join a game.
 *
 * @param gameId - Ostensible game id
 * @param host - Authenticated user creating the invite
 * @param toUsername - Username to invite
 * @returns game id and invited username
 * @throws if game/user is invalid, host does not own game, invitee is not a friend, or invite is redundant
 */
export async function invitePlayerToGame(gameId: string, host: UserWithId, toUsername: string) {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${host.username} inviting to invalid game`);
  if (game.createdBy !== host.userId) {
    throw new Error(`user ${host.username} inviting to game they do not host`);
  }

  const invitee = await getUserByUsername(toUsername);
  if (!invitee) throw new Error(`user ${host.username} inviting nonexistent user`);
  if (game.players.some((userId) => userId === invitee.userId)) {
    throw new Error(`user ${host.username} inviting player already in game`);
  }

  const hostUser = await UserRepo.find(host.userId);
  if (!hostUser) throw new Error(`user ${host.username} inviting with invalid host id`);
  if (!hostUser.friends.includes(invitee.userId)) {
    throw new Error("You can only invite friends to a private game");
  }

  const invitees = game.invitees ?? [];
  if (invitees.includes(invitee.userId)) {
    throw new Error(`user ${host.username} inviting user already invited`);
  }

  game.invitees = [...invitees, invitee.userId];
  await GameRepo.set(gameId, game);

  return {
    gameId,
    toUsername,
  };
}

/**
 * Initializes a game that hasn't started yet
 *
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @returns the necessary views for everyone watching the game
 * @throws if the game id is not valid, if the game already started, or if the game lacks enough
 * players to start
 */
export async function startGame(gameId: string, user: UserWithId): Promise<GameViewUpdates> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} starting invalid game`);
  if (game.state) {
    throw new Error(`user ${user.username} starting game that started`);
  }

  const key: GameKey = game.type;

  if (game.players.length < gameServices[key].minPlayers) {
    throw new Error(`user ${user.username} starting underpopulated game`);
  }
  if (!game.players.some((userId) => userId === user.userId)) {
    throw new Error(`user ${user.username} starting game they're not in`);
  }
  const { state, views } = gameServices[key].create(game.players);

  game.state = state;
  await GameRepo.set(gameId, game);

  return Promise.resolve(views);
}

/**
 * Get a list of all games
 *
 * @returns a list of game summaries, ordered reverse chronologically
 */
export async function getGames(): Promise<GameInfo[]> {
  const keys = await GameRepo.getAllKeys();
  const unsorted = await Promise.all(keys.map(populateGameInfo));

  return unsorted.toSorted((game1, game2) => game2.createdAt.getTime() - game1.createdAt.getTime());
}

/**
 * Represents the result of a game update, including view updates and the
 * move description suffix (the display name is prepended by the caller).
 */
export interface GameUpdateResult {
  views: GameViewUpdates;
  moveDescription: string;
  chatId: string;
}

/**
 * Updates a game state and returns the necessary view updates
 *
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @param move - Unsanitized game move
 * @returns the view updates and move description to send to players and watchers
 * @throws if the game id or move is not valid
 */
export async function updateGame(
  gameId: string,
  user: UserWithId,
  move: unknown,
): Promise<GameUpdateResult> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} acted on an invalid game`);
  if (!game.state) {
    throw new Error(`user ${user.username} made a move in game of that hadn't started`);
  }
  const playerIndex = game.players.findIndex((userId) => userId === user.userId);
  if (playerIndex < 0) {
    throw new Error(`user ${user.username} made a move in a game they weren't playing`);
  }
  const result = gameServices[game.type].update(game.state, move, playerIndex, game.players);
  if (!result) throw new Error(`user ${user.username} made an invalid move in ${game.type}`);

  game.state = result.state;
  game.done = game.done || result.done;

  if (result.done) {
    game.finishedAt = new Date().toISOString();
    game.winnerUserIds = result.winnerIndexes.map((index) => game.players[index]);
  }

  await GameRepo.set(gameId, game);

  return {
    views: result.views,
    moveDescription: result.moveDescription,
    chatId: game.chat,
  };
}

/**
 * Removes a player from a game's waiting room. Only the host may kick, and only
 * before the game has started.
 *
 * @param gameId - Ostensible game id
 * @param host - Authenticated user performing the kick
 * @param toUsername - Username of the player to be kicked
 * @returns the updated game info object
 * @throws if the game is invalid, the host does not own the game, the game has
 * started, or the target player is not in the waiting room
 */
export async function kickPlayer(
  gameId: string,
  host: UserWithId,
  toUsername: string,
): Promise<GameInfo> {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${host.username} kicking from invalid game`);
  if (game.createdBy !== host.userId) {
    throw new Error(`user ${host.username} kicking from game they do not host`);
  }
  if (game.state) {
    throw new Error(`cannot kick players after a game has started`);
  }
  if (host.username === toUsername) {
    throw new Error(`host cannot kick themselves`);
  }

  const target = await getUserByUsername(toUsername);
  if (!target) throw new Error(`user ${toUsername} does not exist`);

  if (!game.players.includes(target.userId)) {
    throw new Error(`user ${toUsername} is not in this game`);
  }

  game.players = game.players.filter((id) => id !== target.userId);
  if (game.invitees) {
    game.invitees = game.invitees.filter((id) => id !== target.userId);
  }
  await GameRepo.set(gameId, game);

  return populateGameInfo(gameId);
}

/**
 * View a game as a specific user
 * @param gameId - Ostensible game id
 * @param user - Authenticated user
 * @returns A boolean for whether that user is a player, the player's view, and the list of players
 */
export async function viewGame(gameId: string, user: UserWithId) {
  const game = await GameRepo.find(gameId);
  if (!game) throw new Error(`user ${user.username} viewed an invalid game id`);
  const playerIndex = game.players.findIndex((userId) => userId === user.userId);
  let view: TaggedGameView | null = null;
  if (game.state) {
    view = gameServices[game.type].view(game.state, playerIndex);
  }
  return {
    isPlayer: playerIndex >= 0,
    view,
    players: await Promise.all(game.players.map(populateSafeUserInfo)),
  };
}
