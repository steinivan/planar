// Guide injected into every Claude Code session (via a SessionStart hook) so
// Claude knows the `planar-graph` convention and emits the block in its plans —
// without any per-project setup. Kept concise to minimise per-session tokens.
export const PLANAR_GRAPH_GUIDE = `Planar graph plans: when you present an implementation plan (ExitPlanMode) with non-trivial structure, append a fenced \`\`\`planar-graph JSON block to the end of the plan so Planar can render it as a visual narrative alongside the document. Model the plan as a STORY, not a file list: give every node a \`role\` so the graph reads left-to-right as problem → cause → fix → outcome. Each step of the reasoning becomes its own node, so a reviewer understands the same thing as the prose — just laid out graphically. Always include at least one \`outcome\` node stating the expected result, so the reviewer can confirm you understood what they actually want. Schema:

\`\`\`planar-graph
{
  "nodes": [
    { "id": "symptom", "role": "problem", "label": "<the symptom or goal>",
      "summary": "<what the user sees, or what we want, in plain language>" },
    { "id": "root", "role": "cause", "label": "<what is wrong>", "change": "modified",
      "summary": "<the concrete cause>", "repo": "<repo>",
      "files": ["path/file"], "functions": ["fn()"] },
    { "id": "patch", "role": "fix", "label": "<the change>", "change": "modified",
      "summary": "<what we change and the resulting behavior>", "files": ["path/file"] },
    { "id": "result", "role": "outcome", "label": "<the expected result>",
      "summary": "<what success looks like / how we will know it worked>" },
    { "id": "rules", "role": "context", "label": "<unchanged piece relied on>",
      "change": "unchanged", "summary": "<why it matters here>" }
  ],
  "edges": [ { "from": "symptom", "to": "root", "label": "caused by" },
             { "from": "root", "to": "patch", "label": "fixed by" },
             { "from": "patch", "to": "result", "label": "results in" } ]
}
\`\`\`

Rules: \`role\` is one of problem | cause | fix | outcome | context and drives the columns — set it on every node, it is the main value. \`outcome\` is the expected result / definition of done in plain language (what success looks like), so the reader can verify the plan targets what they wanted — always include one. Keep \`label\`/\`summary\` plain-language but CONCRETE: a reviewer should grasp the change without reading code (avoid vague labels like "the screen" — say what it does and what changes). Put file paths and functions in \`files\`/\`functions\` (shown only in the per-node detail panel). \`change\` (added|modified|removed|unchanged) colors the node border; \`repo\` is shown as a tag on the node and still groups multi-repo work. \`edges\` connect the story (problem→cause, cause→fix, fix→outcome, fix→context). Omit the block for trivial or single-file plans.`;

export interface SessionContextOutput {
  hookSpecificOutput: {
    hookEventName: "SessionStart";
    additionalContext: string;
  };
}

/** Builds the SessionStart additionalContext payload (pure, unit-tested). */
export function buildSessionContext(
  guide: string = PLANAR_GRAPH_GUIDE,
): SessionContextOutput {
  return {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: guide,
    },
  };
}

export function sessionContextMain(): void {
  process.stdout.write(JSON.stringify(buildSessionContext()) + "\n");
}
