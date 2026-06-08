export interface AnnotatableUnit {
  id: string;
  type:
    | "heading"
    | "paragraph"
    | "list-item"
    | "code-line"
    | "table-row"
    | "blockquote"
    | "other";
  rawText: string;
  sourceStartLine: number;
  sourceEndLine: number;
}

export interface UnitAnnotation {
  id: string;
  startUnitId: string;
  endUnitId: string;
  selectedText: string;
  comment: string;
}

// Data contract shared with the server — single source of truth lives in
// @planar/shared so the two sides can't drift. Re-exported here so UI modules
// keep importing types from "../types".
export type {
  PlanVersion,
  FileSnippet,
  DiffHunkLine,
  DiffHunk,
  FileDiff,
  SessionSummary,
  AcceptMode,
} from "@planar/shared";

// Diff review types (UI-only)

export interface DiffAnnotation {
  id: string;
  filePath: string;
  lineKey: string; // unique key for the diff line (e.g. "hunk-0-line-5")
  startLineKey: string;
  endLineKey: string;
  selectedText: string;
  comment: string;
}

// Graph view types

export type GraphChange = "added" | "modified" | "removed" | "unchanged";

/**
 * Narrative role of a node. When any node sets a role, the graph is laid out as
 * a left-to-right story (problem → cause → fix → outcome, with context
 * alongside) instead of the repo-grouped view. `outcome` captures the expected
 * result so a reviewer can verify the plan targets what they actually wanted.
 */
export type GraphRole = "problem" | "cause" | "fix" | "outcome" | "context";

export interface GraphNode {
  id: string;
  label: string;
  repo?: string;
  change?: GraphChange;
  /** Narrative column the node belongs to (problem/cause/fix/context). */
  role?: GraphRole;
  /** Plain-language description shown in the (non-technical) graph. */
  summary?: string;
  /** Technical detail, shown only in the side panel on demand. */
  files?: string[];
  functions?: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  kind?: string;
}

export interface PlanGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphAnnotation {
  id: string;
  targetType: "node" | "edge";
  /** Node id, or `${from}->${to}` for an edge. */
  targetId: string;
  /** Human-readable label of the target, used in feedback text. */
  targetLabel: string;
  comment: string;
}
