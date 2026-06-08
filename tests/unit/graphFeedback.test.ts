import { describe, test, expect } from "bun:test";
import { formatGraphFeedback } from "../../packages/ui/src/utils/graphFeedback";
import type { GraphAnnotation } from "../../packages/ui/src/types";

function ann(
  overrides: Partial<GraphAnnotation> & { id: string },
): GraphAnnotation {
  return {
    targetType: "node",
    targetId: "n",
    targetLabel: "Node",
    comment: "",
    ...overrides,
  };
}

describe("formatGraphFeedback", () => {
  test("empty input returns empty string", () => {
    expect(formatGraphFeedback([])).toBe("");
    expect(formatGraphFeedback([], "")).toBe("");
  });

  test("general comment only", () => {
    const result = formatGraphFeedback([], "Looks good");
    expect(result).toContain("General feedback:");
    expect(result).toContain("> Looks good");
    expect(result).toMatch(/---$/);
  });

  test("node annotation", () => {
    const result = formatGraphFeedback([
      ann({ id: "1", targetLabel: "Login", comment: "Rename this" }),
    ]);
    expect(result).toContain('Feedback on node: "Login"');
    expect(result).toContain("> Rename this");
  });

  test("edge annotation labelled as connection", () => {
    const result = formatGraphFeedback([
      ann({
        id: "1",
        targetType: "edge",
        targetId: "a->b",
        targetLabel: "A → B",
        comment: "Wrong direction",
      }),
    ]);
    expect(result).toContain('Feedback on connection: "A → B"');
    expect(result).toContain("> Wrong direction");
  });

  test("skips annotations with empty comments", () => {
    const result = formatGraphFeedback([
      ann({ id: "1", comment: "   " }),
      ann({ id: "2", targetLabel: "Real", comment: "keep" }),
    ]);
    expect(result).toContain('## 1. Feedback on node: "Real"');
    expect(result).not.toContain("## 2.");
  });

  test("multiple annotations are numbered", () => {
    const result = formatGraphFeedback([
      ann({ id: "1", targetLabel: "X", comment: "first" }),
      ann({ id: "2", targetLabel: "Y", comment: "second" }),
    ]);
    expect(result).toContain("## 1.");
    expect(result).toContain("## 2.");
  });
});
