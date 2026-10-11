import { describe, expect, it } from "vitest";
import { rankSeniorityIndex } from "../lecturer-rank";

describe("rankSeniorityIndex", () => {
  it("orders Professor before every other rank", () => {
    expect(rankSeniorityIndex("PROFESSOR")).toBeLessThan(rankSeniorityIndex("ASSOCIATE_PROFESSOR"));
    expect(rankSeniorityIndex("PROFESSOR")).toBeLessThan(rankSeniorityIndex("OTHER"));
  });

  it("follows the full seniority chain", () => {
    const order = [
      "PROFESSOR",
      "ASSOCIATE_PROFESSOR",
      "SENIOR_LECTURER",
      "LECTURER_I",
      "LECTURER_II",
      "ASSISTANT_LECTURER",
      "GRADUATE_ASSISTANT",
      "OTHER",
    ] as const;
    for (let i = 0; i < order.length - 1; i++) {
      expect(rankSeniorityIndex(order[i])).toBeLessThan(rankSeniorityIndex(order[i + 1]));
    }
  });
});
