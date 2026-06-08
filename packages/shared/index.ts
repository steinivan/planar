// Single source of truth for the data contract that crosses the server ↔ UI
// boundary. The server produces these shapes (over HTTP/SSE) and the UI
// consumes them; keeping the definitions here prevents the two sides from
// drifting out of sync. Package- or layer-specific types (graph view,
// annotations, server-internal session state) stay in their own packages.

/** A saved revision of a plan, for the version-history / diff UI. */
export interface PlanVersion {
  version: number;
  plan: string;
  timestamp: number;
}

/** Source preview for a backtick-referenced file path in a plan. */
export interface FileSnippet {
  path: string;
  startLine?: number;
  endLine?: number;
  content: string;
  error?: string;
}

/** Which changes a diff review covers. */
export type DiffMode = "unstaged" | "staged" | "all";

export interface DiffHunkLine {
  type: "add" | "remove" | "context";
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

export interface DiffHunk {
  header: string;
  lines: DiffHunkLine[];
}

export interface FileDiff {
  oldPath: string;
  newPath: string;
  status: "modified" | "added" | "deleted" | "renamed";
  hunks: DiffHunk[];
}

/** How an approved plan should treat subsequent edits. */
export type AcceptMode = "normal" | "auto-approve";

/** The per-session payload the server broadcasts to the UI. */
export interface SessionSummary {
  sessionId: string;
  title: string;
  plan: string;
  permissionMode: string;
  previousPlans: PlanVersion[];
  fileSnippets?: FileSnippet[];
  mode?: "plan" | "diff-review";
  fileDiffs?: FileDiff[];
  registeredAt: number;
}
