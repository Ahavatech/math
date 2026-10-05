import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("merges class names and drops falsy values", () => {
    expect(cn("px-2", false && "hidden", "text-sm")).toBe("px-2 text-sm");
  });

  it("lets a later conflicting Tailwind class win", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
