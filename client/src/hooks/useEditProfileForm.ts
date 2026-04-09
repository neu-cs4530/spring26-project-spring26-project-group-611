import { type Dispatch, type SetStateAction, type SubmitEvent, useState } from "react";
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
  const editable = profile ? profileToEditable(profile) : null;
  const baseline = {
    display: profile?.display ?? user.display,
    canViewStats: profile?.canViewStats ?? true,
    age: editable?.age ?? "",
    hometown: editable?.hometown ?? "",
    favoriteGame: editable?.favoriteGame ?? "",
    personalInfoVisibility: editable?.personalInfoVisibility ?? ("private" as const),
  };

  const [displayEdit, setDisplayEdit] = useState<string | null>(null);
  const [canViewStatsEdit, setCanViewStatsEdit] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ageEdit, setAgeEdit] = useState<string | null>(null);
  const [hometownEdit, setHometownEdit] = useState<string | null>(null);
  const [favoriteGameEdit, setFavoriteGameEdit] = useState<string | null>(null);
  const [personalInfoVisibilityEdit, setPersonalInfoVisibilityEdit] = useState<
    "public" | "friends" | "private" | null
  >(null);

  const display = displayEdit ?? baseline.display;
  const canViewStats = canViewStatsEdit ?? baseline.canViewStats;
  const age = ageEdit ?? baseline.age;
  const hometown = hometownEdit ?? baseline.hometown;
  const favoriteGame = favoriteGameEdit ?? baseline.favoriteGame;
  const personalInfoVisibility = personalInfoVisibilityEdit ?? baseline.personalInfoVisibility;

  const setDisplay: Dispatch<SetStateAction<string>> = (value) => {
    setDisplayEdit((old) => {
      const current = old ?? baseline.display;
      return typeof value === "function" ? value(current) : value;
    });
  };

  const setCanViewStats: Dispatch<SetStateAction<boolean>> = (value) => {
    setCanViewStatsEdit((old) => {
      const current = old ?? baseline.canViewStats;
      return typeof value === "function" ? value(current) : value;
    });
  };

  const setAge: Dispatch<SetStateAction<string>> = (value) => {
    setAgeEdit((old) => {
      const current = old ?? baseline.age;
      return typeof value === "function" ? value(current) : value;
    });
  };

  const setHometown: Dispatch<SetStateAction<string>> = (value) => {
    setHometownEdit((old) => {
      const current = old ?? baseline.hometown;
      return typeof value === "function" ? value(current) : value;
    });
  };

  const setFavoriteGame: Dispatch<SetStateAction<string>> = (value) => {
    setFavoriteGameEdit((old) => {
      const current = old ?? baseline.favoriteGame;
      return typeof value === "function" ? value(current) : value;
    });
  };

  const setPersonalInfoVisibility: Dispatch<SetStateAction<"public" | "friends" | "private">> = (
    value,
  ) => {
    setPersonalInfoVisibilityEdit((old) => {
      const current = old ?? baseline.personalInfoVisibility;
      return typeof value === "function" ? value(current) : value;
    });
  };

  const [err, setErr] = useState<null | string>(null);
  const auth = useAuth();

  /**
   * Handles submission of the form
   */
  const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();

    // if (user.display === display && password === confirm && password === "" && canViewStats) {
    //   setErr("No changes to submit");
    //   return;
    // }
    const noDisplayChange = display === baseline.display;
    const noStatsVisibilityChange = canViewStats === baseline.canViewStats;
    const noPersonalInfoChange =
      age === baseline.age &&
      hometown === baseline.hometown &&
      favoriteGame === baseline.favoriteGame &&
      personalInfoVisibility === baseline.personalInfoVisibility;
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
    if (display !== baseline.display) updates.display = display;
    if (password !== "") updates.password = password;
    if (canViewStats !== baseline.canViewStats) updates.canViewStats = canViewStats;
    if (age !== baseline.age) updates.age = parsedAge;
    if (hometown !== baseline.hometown)
      updates.hometown = hometown.trim() === "" ? null : hometown.trim();
    if (favoriteGame !== baseline.favoriteGame)
      updates.favoriteGame = favoriteGame.trim() === "" ? null : favoriteGame.trim();
    if (personalInfoVisibility !== baseline.personalInfoVisibility)
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
