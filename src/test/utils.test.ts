import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("handles conditionals", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
  it("dedupes tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
