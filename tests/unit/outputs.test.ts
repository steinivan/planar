import { describe, test, expect } from "bun:test";
import { buildDecisionOutput } from "../../src/outputs";
import { buildSessionContext, PLANAR_GRAPH_GUIDE } from "../../src/graph-guide";

describe("buildDecisionOutput", () => {
  test("allow has no message and no permission changes by default", () => {
    const out = buildDecisionOutput("allow");
    expect(out.hookSpecificOutput.hookEventName).toBe("PermissionRequest");
    expect(out.hookSpecificOutput.decision).toEqual({ behavior: "allow" });
  });

  test("deny includes a message, defaulting when none is given", () => {
    expect(buildDecisionOutput("deny").hookSpecificOutput.decision).toEqual({
      behavior: "deny",
      message: "Plan changes requested",
    });
    expect(
      buildDecisionOutput("deny", "needs work").hookSpecificOutput.decision,
    ).toEqual({ behavior: "deny", message: "needs work" });
  });

  test("auto-approve on allow attaches the acceptEdits permission", () => {
    const decision = buildDecisionOutput("allow", undefined, "auto-approve")
      .hookSpecificOutput.decision;
    expect(decision.behavior).toBe("allow");
    expect(decision.updatedPermissions).toEqual([
      { type: "setMode", mode: "acceptEdits", destination: "session" },
    ]);
  });

  test("acceptMode is ignored on deny", () => {
    const decision = buildDecisionOutput("deny", "x", "auto-approve")
      .hookSpecificOutput.decision;
    expect(decision.updatedPermissions).toBeUndefined();
  });
});

describe("buildSessionContext", () => {
  test("wraps the graph guide as SessionStart additionalContext", () => {
    const out = buildSessionContext();
    expect(out.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(out.hookSpecificOutput.additionalContext).toBe(PLANAR_GRAPH_GUIDE);
    expect(out.hookSpecificOutput.additionalContext).toContain("planar-graph");
  });
});
