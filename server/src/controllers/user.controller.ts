import {
  type ProfileViewInfo,
  type SafeUserInfo,
  withAuth,
  zUserAuth,
  zUserUpdateRequest,
} from "@gamenite/shared";
import {
  createUser,
  getProfileViewByUsername,
  getUsersByUsername,
  populateSafeUserInfo,
  searchUsersByUsername,
  updateUser,
} from "../services/user.service.ts";
import { type RestAPI } from "../types.ts";
import { z } from "zod";
import { checkAuth, getUserByUsername } from "../services/auth.service.ts";

/**
 * Handles user login by validating credentials.
 * @param req The request containing username and password in the body.
 * @param res The response, either returning the user or an error.
 */
export const postLogin: RestAPI<SafeUserInfo> = async (req, res) => {
  const userAuth = zUserAuth.safeParse(req.body);
  if (!userAuth.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(userAuth.data);
  if (!user) {
    res.send({ error: "Invalid username or password" });
    return;
  }

  res.send(await populateSafeUserInfo(user.userId));
};

/**
 * Update a user's information
 * @param req A request containing a new password
 * @param res The response, either returning the updated user or an error
 */
export const postByUsername: RestAPI<SafeUserInfo, { username: string }> = async (req, res) => {
  const body = withAuth(zUserUpdateRequest).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user || user.username !== req.params.username) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  res.send(await updateUser(req.params.username, body.data.payload));
};

/**
 * Handles the creation of a new user account.
 * @param req The request containing username and password in the body.
 * @param res The response, either returning the created user or an error.
 * @returns A promise resolving to void.
 */
export const postSignup: RestAPI<SafeUserInfo> = async (req, res) => {
  const userAuth = zUserAuth.safeParse(req.body);
  if (!userAuth.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  res.send(await createUser(userAuth.data.username, userAuth.data.password, new Date()));
};

/**
 * Retrieves a user by their username.
 * @param req The request containing the username as a route parameter.
 * @param res The response, either returning the user (200) or an error.
 */
export const getByUsername: RestAPI<SafeUserInfo, { username: string }> = async (req, res) => {
  const user = await getUserByUsername(req.params.username);
  if (!user) {
    res.status(404).send({ error: "User not found" });
    return;
  }
  res.send(await populateSafeUserInfo(user.userId));
};

/**
 * Retrieves a profile as viewed by an authenticated user.
 */
export const postByUsernameView: RestAPI<ProfileViewInfo, { username: string }> = async (
  req,
  res,
) => {
  const body = withAuth(z.object({})).safeParse(req.body);
  if (!body.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const viewer = await checkAuth(body.data.auth);
  if (!viewer) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  const viewed = await getProfileViewByUsername(req.params.username, viewer.username);
  if (!viewed) {
    res.status(404).send({ error: "User not found" });
    return;
  }

  res.send(viewed);
};

/**
 * Returns the user information for a list of users
 */
export const postList: RestAPI<SafeUserInfo[]> = async (req, res) => {
  const usernames = z.array(z.string()).safeParse(req.body);
  if (!usernames.success) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  let users: SafeUserInfo[];
  try {
    users = await getUsersByUsername(usernames.data);
  } catch {
    res.send({ error: "Usernames do not all exist" });
    return;
  }

  res.send(users);
};

/**
 * Search for users by username (partial matches allowed)
 */
export const getSearch: RestAPI<SafeUserInfo[]> = async (req, res) => {
  const query = z.string().safeParse(req.query.username);

  if (!query.success) {
    res.status(400).send({ error: "Username query required" });
    return;
  }

  try {
    const users = await searchUsersByUsername(query.data);
    res.send(users);
  } catch {
    res.status(500).send({ error: "Failed to search users" });
  }
};
