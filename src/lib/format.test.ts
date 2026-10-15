import { describe, expect, it } from "vitest";
import { formatPrice } from "./format";

describe("formatPrice", () => {
  it("drops the cents on whole-dollar amounts", () => {
    expect(formatPrice(295000)).toBe("$2,950");
    expect(formatPrice(100)).toBe("$1");
    expect(formatPrice(0)).toBe("$0");
  });

  it("keeps the cents instead of rounding", () => {
    expect(formatPrice(4950)).toBe("$49.50");
    expect(formatPrice(4999)).toBe("$49.99");
    expect(formatPrice(5)).toBe("$0.05");
    expect(formatPrice(123456789)).toBe("$1,234,567.89");
  });
});
