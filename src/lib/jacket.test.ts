import { describe, expect, it } from "vitest";
import { canPlace, emptySlots, orderSchema, trimToLimit, countPlaced, toArabicDigits } from "./jacket";

const valid = { num: "01", initials: "EM", country: "SY", sleeveNumber: "09" as const, size: "M", name: "AAAAAA", patchNum: 6, grade: "12A", note: "", backStyle: "en" as const, quote: "" };

describe("order rules", () => {
  it("accepts a complete order", () => {
    expect(orderSchema.safeParse(valid).success).toBe(true);
  });
  it.each(["num", "size", "name", "grade"])("requires %s", (k) => {
    expect(orderSchema.safeParse({ ...valid, [k]: "" }).success).toBe(false);
  });
  it("only allows PATCH NUM between 1 and 6", () => {
    expect(orderSchema.safeParse({ ...valid, patchNum: 0 }).success).toBe(false);
    expect(orderSchema.safeParse({ ...valid, patchNum: 7 }).success).toBe(false);
  });
  it("accepts Arabic names", () => {
    expect(orderSchema.safeParse({ ...valid, name: "محمد" }).success).toBe(true);
  });
  it("limits initials to one or two letters", () => {
    expect(orderSchema.safeParse({ ...valid, initials: "A" }).success).toBe(true);
    expect(orderSchema.safeParse({ ...valid, initials: "ABC" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...valid, initials: "A1" }).success).toBe(false);
  });
  it("accepts only supported countries and sleeve numbers", () => {
    expect(orderSchema.safeParse({ ...valid, country: "US", sleeveNumber: "07" }).success).toBe(true);
    expect(orderSchema.safeParse({ ...valid, country: "USA" }).success).toBe(false);
    expect(orderSchema.safeParse({ ...valid, sleeveNumber: "10" }).success).toBe(false);
  });
  it("blocks placing more patches than PATCH NUM", () => {
    const s = { ...emptySlots(), L1: "bmw" as const, L2: "horse" as const };
    expect(canPlace(s, "R1", 2)).toBe(false);
    expect(canPlace(s, "L1", 2)).toBe(true); // replacing is fine
    expect(canPlace(s, "R1", 3)).toBe(true);
  });
  it("removes extra patches when PATCH NUM is lowered", () => {
    const s = { ...emptySlots(), L1: "bmw" as const, L2: "horse" as const, R3: "flag" as const };
    const t = trimToLimit(s, 1);
    expect(countPlaced(t)).toBe(1);
    expect(t.L1).toBe("bmw");
  });
  it("converts 27 to Arabic digits", () => {
    expect(toArabicDigits("27")).toBe("٢٧");
  });
});
