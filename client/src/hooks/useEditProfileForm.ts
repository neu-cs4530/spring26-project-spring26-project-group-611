import { type SubmitEvent, useEffect, useState } from "react";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";
import { updateUser } from "../services/userService.ts";
import type { ProfileViewInfo, UserUpdateRequest } from "@gamenite/shared";

type EditablePersonalInfo = {
  age: string;
  hometown: string;
  favoriteGame: string;
  personalInfoVisibility: "public" | "friends" | "private";
};

function profileToEditable(profile: ProfileViewInfo): EditablePersonalInfo {
  return {
    age:
      profile.personalInfo?.age === null || profile.personalInfo?.age === undefined
        ? ""
        : `${profile.personalInfo?.age}`,
    hometown: profile.personalInfo?.hometown ?? "",
    favoriteGame: profile.personalInfo?.favoriteGame ?? "",
    personalInfoVisibility: profile.personalInfoVisibility,
  };
}

/**
 * Custom hook to manage profile form logic
 * @returns an object containing
 *  - Form values `display`, `password`, and `confirm`
 *  - Form setters `setDisplay`, `setPassword`, and `setConfirm`
 *  - Possibly-null error message `err`
 *  - Submission handler `handleSubmit`
 */
export default function useEditProfileForm(profile: ProfileViewInfo | null) {
  const { user, reset } = useLoginContext();
  const [display, setDisplay] = useState(user.display);
  const [canViewStats, setCanViewStats] = useState(profile?.canViewStats ?? true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [age, setAge] = useState(profile ? profileToEditable(profile).age : "");
  const [hometown, setHometown] = useState(profile ? profileToEditable(profile).hometown : "");
  const [favoriteGame, setFavoriteGame] = useState(
    profile ? profileToEditable(profile).favoriteGame : "",
  );
  const [personalInfoVisibility, setPersonalInfoVisibility] = useState<
    "public" | "friends" | "private"
  >(profile ? profileToEditable(profile).personalInfoVisibility : "private");
  const [initialDisplay, setInitialDisplay] = useState(user.display);
  const [initialCanViewStats, setInitialCanViewStats] = useState(profile?.canViewStats ?? true);
  const [initialAge, setInitialAge] = useState(profile ? profileToEditable(profile).age : "");
  const [initialHometown, setInitialHometown] = useState(
    profile ? profileToEditable(profile).hometown : "",
  );
  const [initialFavoriteGame, setInitialFavoriteGame] = useState(
    profile ? profileToEditable(profile).favoriteGame : "",
  );
  const [initialPersonalInfoVisibility, setInitialPersonalInfoVisibility] = useState<
    "public" | "friends" | "private"
  >(profile ? profileToEditable(profile).personalInfoVisibility : "private");
  const [err, setErr] = useState<null | string>(null);
  const auth = useAuth();

  useEffect(() => {
    if (!profile) return;
    setDisplay(profile.display);
    setInitialDisplay(profile.display);
    setCanViewStats(profile.canViewStats);
    setInitialCanViewStats(profile.canViewStats);
    const editable = profileToEditable(profile);
    setAge(editable.age);
    setHometown(editable.hometown);
    setFavoriteGame(editable.favoriteGame);
    setPersonalInfoVisibility(editable.personalInfoVisibility);
    setInitialAge(editable.age);
    setInitialHometown(editable.hometown);
    setInitialFavoriteGame(editable.favoriteGame);
    setInitialPersonalInfoVisibility(editable.personalInfoVisibility);
  }, [profile]);
  /**
   * Handles submission of the form
   */
  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    // if (user.display === display && password === confirm && password === "" && canViewStats) {
    //   setErr("No changes to submit");
    //   return;
    // }
    const noDisplayChange = display === initialDisplay;
    const noStatsVisibilityChange = canViewStats === initialCanViewStats;
    const noPersonalInfoChange =
      age === initialAge &&
      hometown === initialHometown &&
      favoriteGame === initialFavoriteGame &&
      personalInfoVisibility === initialPersonalInfoVisibility;
    if (noDisplayChange && password === "" && noStatsVisibilityChange && noPersonalInfoChange) {
      setErr("No changes to submit");
      return;
    }

    if (display.trim() !== display) {
      setErr("Display names can't begin or end with whitespace");
      return;
    }

    if (display.trim() === "") {
      setErr("Please enter a display name");
      return;
    }

    if (password.trim() !== password) {
      setErr("Passwords can't begin or end with whitespace");
      return;
    }

    if (password !== confirm) {
      setErr("Passwords don't match");
      return;
    }

    const parsedAge = age.trim() === "" ? null : Number(age);
    if (parsedAge !== null && (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 150)) {
      setErr("Age must be an integer between 0 and 150");
      return;
    }

    const updates: UserUpdateRequest = {};
    if (display !== initialDisplay) updates.display = display;
    if (password !== "") updates.password = password;
    if (canViewStats !== initialCanViewStats) updates.canViewStats = canViewStats;
    if (age !== initialAge) updates.age = parsedAge;
    if (hometown !== initialHometown)
      updates.hometown = hometown.trim() === "" ? null : hometown.trim();
    if (favoriteGame !== initialFavoriteGame)
      updates.favoriteGame = favoriteGame.trim() === "" ? null : favoriteGame.trim();
    if (personalInfoVisibility !== initialPersonalInfoVisibility)
      updates.personalInfoVisibility = personalInfoVisibility;
    const response = await updateUser(auth, updates);
    if ("error" in response) {
      setErr(response.error);
      return;
    }

    // We need to do this — or do something else that resets the login context
    reset();
  };

  return {
    display,
    setDisplay,
    canViewStats,
    setCanViewStats,
    age,
    setAge,
    hometown,
    setHometown,
    favoriteGame,
    setFavoriteGame,
    personalInfoVisibility,
    setPersonalInfoVisibility,
    password,
    setPassword,
    confirm,
    setConfirm,
    err,
    handleSubmit,
  };
}
