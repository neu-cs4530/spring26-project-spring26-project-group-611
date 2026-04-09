import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import useLoginContext from "../../src/hooks/useLoginContext.ts";

describe("useLoginContext", () => {
  it("throws when used outside the login provider", () => {
    expect(() => renderHook(() => useLoginContext())).toThrow("Login context is null.");
  });
});
