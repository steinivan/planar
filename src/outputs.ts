// stdout contract with Claude Code. The hook communicates its result purely
// through a single JSON object on stdout; these builders are pure so the exact
// shape can be unit-tested without spawning the process.

export interface DecisionOutput {
  hookSpecificOutput: {
    hookEventName: "PermissionRequest";
    decision: Record<string, unknown>;
  };
}

/** Builds the PermissionRequest decision object Claude Code expects. */
export function buildDecisionOutput(
  behavior: "allow" | "deny",
  message?: string,
  acceptMode?: string,
): DecisionOutput {
  const decision: Record<string, unknown> = { behavior };
  if (behavior === "deny") {
    decision.message = message || "Plan changes requested";
  }
  if (behavior === "allow" && acceptMode === "auto-approve") {
    decision.updatedPermissions = [
      { type: "setMode", mode: "acceptEdits", destination: "session" },
    ];
  }
  return {
    hookSpecificOutput: { hookEventName: "PermissionRequest", decision },
  };
}

/** Writes the decision to stdout (the side-effecting wrapper). */
export function outputDecision(
  behavior: "allow" | "deny",
  message?: string,
  acceptMode?: string,
): void {
  process.stdout.write(
    JSON.stringify(buildDecisionOutput(behavior, message, acceptMode)) + "\n",
  );
}
