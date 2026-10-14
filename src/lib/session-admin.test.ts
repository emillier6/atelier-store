import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * requireAdmin guards every admin page, query and action (there is no
 * proxy.ts). Better Auth's session read, Next's request headers and its
 * redirect/notFound are replaced: redirect and notFound throw recognisable
 * errors, as the real ones throw to stop rendering.
 */

const getSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

const { requireAdmin, requireUser } = await import("@/lib/session");

const baseUser = {
  id: "u1",
  name: "Test",
  email: "t@example.test",
  emailVerified: false,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  getSession.mockReset();
});

describe("requireAdmin", () => {
  it("redirects a signed-out visitor to sign-in with next", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireAdmin("/admin/orders?q=a&b=1")).rejects.toThrow(
      `REDIRECT:/sign-in?next=${encodeURIComponent("/admin/orders?q=a&b=1")}`,
    );
  });

  it("404s a signed-in customer", async () => {
    getSession.mockResolvedValue({ user: { ...baseUser, role: "customer" } });
    await expect(requireAdmin("/admin")).rejects.toThrow("NOT_FOUND");
  });

  it("404s a user with no role or an unexpected one", async () => {
    getSession.mockResolvedValue({ user: { ...baseUser } });
    await expect(requireAdmin("/admin")).rejects.toThrow("NOT_FOUND");
    getSession.mockResolvedValue({ user: { ...baseUser, role: "Admin" } });
    await expect(requireAdmin("/admin")).rejects.toThrow("NOT_FOUND");
  });

  it("returns the admin", async () => {
    const admin = { ...baseUser, role: "admin" };
    getSession.mockResolvedValue({ user: admin });
    await expect(requireAdmin("/admin")).resolves.toEqual(admin);
  });

  it("passes the request headers to Better Auth", async () => {
    getSession.mockResolvedValue({ user: { ...baseUser, role: "admin" } });
    await requireAdmin("/admin");
    expect(getSession).toHaveBeenCalledWith({ headers: expect.any(Headers) });
  });
});

describe("requireUser", () => {
  it("redirects a signed-out visitor", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireUser("/bag")).rejects.toThrow(
      "REDIRECT:/sign-in?next=%2Fbag",
    );
  });

  it("returns a customer", async () => {
    const customer = { ...baseUser, role: "customer" };
    getSession.mockResolvedValue({ user: customer });
    await expect(requireUser("/bag")).resolves.toEqual(customer);
  });
});
