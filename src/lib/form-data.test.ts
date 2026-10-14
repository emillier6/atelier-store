import { describe, expect, it } from "vitest";
import {
  field,
  type Read,
  readCents,
  readHttpsUrl,
  readInt,
  readLines,
  readOneOf,
  readSlug,
  readText,
  readUuid,
} from "@/lib/form-data";

function fd(entries: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

const one = (value: string) => fd({ v: value });

function value<T>(read: Read<T>) {
  if (!read.ok) throw new Error(`expected ok, got "${read.error}"`);
  return read.value;
}

describe("readCents", () => {
  it.each([
    ["295", 29_500],
    ["29.50", 2_950],
    ["29.5", 2_950],
    ["29.05", 2_905],
    ["0", 0],
    ["0.01", 1],
    ["1,200", 120_000],
    ["  42  ", 4_200],
  ])("reads %j as %i cents", (raw, cents) => {
    expect(value(readCents(one(raw), "v"))).toBe(cents);
  });

  it.each([
    ["three decimals", "29.505"],
    ["negative", "-1"],
    ["letters", "abc"],
    ["empty", ""],
    ["trailing dot", "29."],
    ["leading dot", ".5"],
    ["exponent", "1e3"],
    ["currency sign", "$5"],
  ])("rejects %s", (_, raw) => {
    expect(readCents(one(raw), "v").ok).toBe(false);
  });

  it("rejects a missing field", () => {
    expect(readCents(fd({}), "v").ok).toBe(false);
  });

  it("enforces max (in cents)", () => {
    expect(value(readCents(one("100"), "v", { max: 10_000 }))).toBe(10_000);
    expect(readCents(one("100.01"), "v", { max: 10_000 }).ok).toBe(false);
    // Default max is $100,000.
    expect(readCents(one("100000.01"), "v").ok).toBe(false);
  });

  it("never returns a fractional cent", () => {
    for (const raw of ["0.1", "0.29", "19.99", "1,234.56"]) {
      expect(Number.isInteger(value(readCents(one(raw), "v")))).toBe(true);
    }
    expect(value(readCents(one("19.99"), "v"))).toBe(1_999);
  });
});

describe("readSlug", () => {
  it("lowercases and trims", () => {
    expect(value(readSlug(one("  Silk-Shirt "), "v"))).toBe("silk-shirt");
  });

  it.each([
    ["empty", ""],
    ["double hyphen", "a--b"],
    ["leading hyphen", "-a"],
    ["trailing hyphen", "a-"],
    ["space", "a b"],
    ["slash", "a/b"],
    ["dot-dot", ".."],
    ["too long", "a".repeat(121)],
  ])("rejects %s", (_, raw) => {
    expect(readSlug(one(raw), "v").ok).toBe(false);
  });

  it("accepts exactly 120 characters", () => {
    expect(readSlug(one("a".repeat(120)), "v").ok).toBe(true);
  });
});

describe("readUuid", () => {
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";

  it("accepts and lowercases a uuid", () => {
    expect(value(readUuid(one(id.toUpperCase()), "v"))).toBe(id);
  });

  it.each(["", "not-a-uuid", `${id}x`, `'${id}'`, id.replace(/-/g, "")])(
    "rejects %j",
    (raw) => {
      expect(readUuid(one(raw), "v").ok).toBe(false);
    },
  );
});

describe("readInt", () => {
  const bounds = { min: -5, max: 10 };

  it("accepts the bounds and values between", () => {
    expect(value(readInt(one("-5"), "v", bounds))).toBe(-5);
    expect(value(readInt(one("10"), "v", bounds))).toBe(10);
    expect(value(readInt(one("0"), "v", bounds))).toBe(0);
  });

  it.each(["-6", "11", "1.5", "1e1", "", "abc", "0x1", "+1"])(
    "rejects %j",
    (raw) => {
      expect(readInt(one(raw), "v", bounds).ok).toBe(false);
    },
  );

  it("rejects a huge number rather than losing precision", () => {
    expect(
      readInt(one("99999999999999999999"), "v", { min: 0, max: 100 }).ok,
    ).toBe(false);
  });
});

describe("readLines", () => {
  const limits = { maxItems: 3, maxLength: 5 };

  it("splits on newlines, trims and drops blanks", () => {
    expect(value(readLines(one(" a \r\n\n b\n\nc "), "v", limits))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("reads an empty field as no lines", () => {
    expect(value(readLines(one(""), "v", limits))).toEqual([]);
  });

  it("rejects too many lines", () => {
    expect(readLines(one("a\nb\nc\nd"), "v", limits).ok).toBe(false);
  });

  it("rejects a line that is too long", () => {
    expect(readLines(one("a\nabcdef"), "v", limits).ok).toBe(false);
    expect(readLines(one("abcde"), "v", limits).ok).toBe(true);
  });
});

describe("readHttpsUrl", () => {
  it("accepts https", () => {
    expect(value(readHttpsUrl("https://img.example.com/a.jpg"))).toBe(
      "https://img.example.com/a.jpg",
    );
  });

  it.each([
    "http://example.com/a.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
    "//example.com/a.jpg",
    "/a.jpg",
    "not a url",
    "",
  ])("rejects %j", (raw) => {
    expect(readHttpsUrl(raw).ok).toBe(false);
  });
});

describe("readOneOf", () => {
  const allowed = ["draft", "active"] as const;

  it("accepts an allowed value (trimmed)", () => {
    expect(value(readOneOf(one(" active "), "v", allowed))).toBe("active");
  });

  it.each(["", "Active", "archived", "active;"])("rejects %j", (raw) => {
    expect(readOneOf(one(raw), "v", allowed).ok).toBe(false);
  });
});

describe("readText", () => {
  it("is required unless optional", () => {
    expect(readText(one("  "), "v", { max: 5 }).ok).toBe(false);
    expect(value(readText(one("  "), "v", { max: 5, optional: true }))).toBe(
      null,
    );
  });

  it("enforces max after trimming", () => {
    expect(value(readText(one("  abcde  "), "v", { max: 5 }))).toBe("abcde");
    expect(readText(one("abcdef"), "v", { max: 5 }).ok).toBe(false);
  });

  it("ignores a File posted in place of text", () => {
    const formData = new FormData();
    formData.set("v", new Blob(["x"]), "x.txt");
    expect(readText(formData, "v", { max: 5 }).ok).toBe(false);
  });
});

describe("field", () => {
  it("returns the value and records nothing on success", () => {
    const errors: Record<string, string> = {};
    expect(field(errors, "price", readCents(one("1"), "v"))).toBe(100);
    expect(errors).toEqual({});
  });

  it("records the message under the key and returns undefined", () => {
    const errors: Record<string, string> = {};
    expect(field(errors, "price", readCents(one("x"), "v"))).toBeUndefined();
    expect(errors.price).toMatch(/amount/);
  });

  it("returns a falsy value (0, null) rather than undefined", () => {
    const errors: Record<string, string> = {};
    expect(field(errors, "a", readCents(one("0"), "v"))).toBe(0);
    expect(
      field(errors, "b", readText(one(""), "v", { max: 1, optional: true })),
    ).toBeNull();
    expect(errors).toEqual({});
  });
});
