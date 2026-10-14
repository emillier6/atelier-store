import { randomUUID } from "node:crypto";
import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { rateLimit } from "@/db/schema";

// clientKey isn't under test; skip building the Better Auth instance.
vi.mock("@/lib/auth", () => ({ auth: { options: {} } }));

const { consume, reset } = await import("@/lib/rate-limit");

// Runs against the dev database: every key is unique to this run and every
// row it creates is deleted afterwards. consume() stores keys as "action:<key>".
const RUN = `test:${randomUUID()}`;
const key = (name: string) => `${RUN}:${name}`;
const stored = (name: string) => `action:${key(name)}`;

// Keep consume()'s occasional prune of expired rows out of these tests.
vi.spyOn(Math, "random").mockReturnValue(0.5);

afterAll(async () => {
  await db.delete(rateLimit).where(like(rateLimit.key, `action:${RUN}:%`));
});

async function row(name: string) {
  const [found] = await db
    .select()
    .from(rateLimit)
    .where(eq(rateLimit.key, stored(name)));
  return found;
}

describe("consume", () => {
  it("allows max attempts per window, then refuses", async () => {
    const rule = { window: 60, max: 3 };
    const now = Date.now();
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await consume(key("max"), rule, now));
    expect(results).toEqual([true, true, true, false, false]);
    // Refused attempts are still counted; last_request is the window's end.
    expect(await row("max")).toMatchObject({ count: 5, lastRequest: now + 60_000 });
  });

  it("starts a new window once the old one has ended", async () => {
    const rule = { window: 1, max: 2 };
    const start = Date.now();
    expect(await consume(key("expiry"), rule, start)).toBe(true);
    expect(await consume(key("expiry"), rule, start + 500)).toBe(true);
    expect(await consume(key("expiry"), rule, start + 999)).toBe(false);
    // Fixed window: it ends 1s after the first attempt, not the last.
    expect(await consume(key("expiry"), rule, start + 1000)).toBe(true);
    expect(await row("expiry")).toMatchObject({ count: 1, lastRequest: start + 2000 });
    expect(await consume(key("expiry"), rule, start + 1001)).toBe(true);
    expect(await consume(key("expiry"), rule, start + 1002)).toBe(false);
  });

  it("keeps separate keys separate", async () => {
    const rule = { window: 60, max: 1 };
    expect(await consume(key("a"), rule)).toBe(true);
    expect(await consume(key("a"), rule)).toBe(false);
    expect(await consume(key("b"), rule)).toBe(true);
  });

  it("counts concurrent attempts exactly", async () => {
    const rule = { window: 60, max: 4 };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => consume(key("concurrent"), rule)),
    );
    expect(results.filter(Boolean)).toHaveLength(4);
    expect((await row("concurrent")).count).toBe(10);
  });
});

describe("reset", () => {
  it("clears the bucket", async () => {
    const rule = { window: 60, max: 1 };
    expect(await consume(key("reset"), rule)).toBe(true);
    expect(await consume(key("reset"), rule)).toBe(false);
    await reset(key("reset"));
    expect(await row("reset")).toBeUndefined();
    expect(await consume(key("reset"), rule)).toBe(true);
  });

  it("is a no-op for an unknown key", async () => {
    await expect(reset(key("never-used"))).resolves.toBeUndefined();
  });
});
