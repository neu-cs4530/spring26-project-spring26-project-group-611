import { renderHook, act } from "@testing-library/react";
import type { ChangeEvent, SubmitEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import useLoginForm from "../../src/hooks/useLoginForm.ts";
import { loginUser, signupUser } from "../../src/services/userService.ts";

const mockedNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...mod, useNavigate: () => mockedNavigate };
});

vi.mock("../../src/services/userService.ts", () => ({
  loginUser: vi.fn(),
  signupUser: vi.fn(),
}));

function changeValue(value: string) {
  return { target: { value } } as ChangeEvent<HTMLInputElement>;
}

function submitEvent() {
  return { preventDefault: vi.fn() } as unknown as SubmitEvent<HTMLFormElement>;
}

describe("useLoginForm", () => {
  const setAuth = vi.fn();

  beforeEach(() => {
    setAuth.mockReset();
    mockedNavigate.mockReset();
    vi.mocked(loginUser).mockReset();
    vi.mocked(signupUser).mockReset();
  });

  it("switches between login and signup mode", () => {
    const { result } = renderHook(() => useLoginForm(setAuth));

    expect(result.current.mode).toBe("login");

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.mode).toBe("signup");

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.mode).toBe("login");
  });

  it("validates missing login fields before calling the API", async () => {
    const { result } = renderHook(() => useLoginForm(setAuth));

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.err).toBe("Please enter a username and password");
    expect(loginUser).not.toHaveBeenCalled();
    expect(signupUser).not.toHaveBeenCalled();
  });

  it("validates mismatched signup passwords before calling the API", async () => {
    const { result } = renderHook(() => useLoginForm(setAuth));

    act(() => {
      result.current.toggleMode();
    });

    act(() => {
      result.current.handleInputChange(changeValue("newuser"), "username");
      result.current.handleInputChange(changeValue("secret1"), "password");
      result.current.handleInputChange(changeValue("secret2"), "confirm");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(result.current.err).toBe("Passwords don't match");
    expect(signupUser).not.toHaveBeenCalled();
    expect(loginUser).not.toHaveBeenCalled();
  });

  it("calls the login API in login mode and navigates on success", async () => {
    const loggedInUser = {
      username: "user1",
      display: "User One",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      acceptGameInvites: true,
    };
    vi.mocked(loginUser).mockResolvedValue(loggedInUser);

    const { result } = renderHook(() => useLoginForm(setAuth));

    act(() => {
      result.current.handleInputChange(changeValue("user1"), "username");
      result.current.handleInputChange(changeValue("pw"), "password");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(loginUser).toHaveBeenCalledExactlyOnceWith({ username: "user1", password: "pw" });
    expect(signupUser).not.toHaveBeenCalled();
    expect(setAuth).toHaveBeenCalledTimes(1);

    const authArg = setAuth.mock.calls[0][0];
    expect(authArg.user).toEqual(loggedInUser);
    expect(authArg.pass).toBe("pw");
    expect(typeof authArg.reset).toBe("function");

    authArg.reset();
    expect(setAuth).toHaveBeenCalledWith(null);
    expect(mockedNavigate).toHaveBeenCalledExactlyOnceWith("/");
  });

  it("calls the signup API in signup mode and surfaces API errors", async () => {
    vi.mocked(signupUser).mockResolvedValue({ error: "username already exists" });

    const { result } = renderHook(() => useLoginForm(setAuth));

    act(() => {
      result.current.toggleMode();
      result.current.handleInputChange(changeValue("newuser"), "username");
      result.current.handleInputChange(changeValue("secret"), "password");
      result.current.handleInputChange(changeValue("secret"), "confirm");
    });

    await act(async () => {
      await result.current.handleSubmit(submitEvent());
    });

    expect(signupUser).toHaveBeenCalledExactlyOnceWith({ username: "newuser", password: "secret" });
    expect(loginUser).not.toHaveBeenCalled();
    expect(result.current.err).toBe("username already exists");
    expect(setAuth).not.toHaveBeenCalled();
    expect(mockedNavigate).not.toHaveBeenCalled();
  });
});