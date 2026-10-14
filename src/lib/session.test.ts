import { describe, expect, it, vi } from "vitest";

// session.ts imports Next's request APIs and Better Auth; only the pure
// helper is under test here.
vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

const { safeNextPath } = await import("@/lib/session");

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/account")).toBe("/account");
    expect(safeNextPath("/products/a?x=1#y")).toBe("/products/a?x=1#y");
  });

  it.each([
    ["missing", undefined],
    ["not a string", 42],
    ["absolute URL", "https://evil.com"],
    ["protocol-relative", "//evil.com"],
    ["backslash trick", "/\\evil.com"],
    ["control character", "/a\nb"],
    ["too long", `/${"a".repeat(600)}`],
  ])("falls back to / when %s", (_, raw) => {
    expect(safeNextPath(raw)).toBe("/");
  });
});
